
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService }     from '../../common/prisma/prisma.service';
import { EncryptionService } from '../../common/encryption/encryption.service';
import { WebhooksService }   from '../webhooks/webhooks.service';
import { TransactionsService } from '../transactions/transactions.service';
import { TransactionType } from '@prisma/client';

// ─── imapflow (cliente IMAP moderno, async/await nativo) ─────────────────────
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ImapFlow } = require('imapflow') as typeof import('imapflow');

// ─── Tipos internos ───────────────────────────────────────────────────────────

interface ImapConfig {
  host:     string;
  port:     number;
  user:     string;
  password: string;
  mailbox:  string;
  tls:      boolean;
}

// ─── Servicio ─────────────────────────────────────────────────────────────────

@Injectable()
export class EmailIngestionService implements OnModuleDestroy {
  private readonly logger = new Logger(EmailIngestionService.name);

  /** Evita ciclos de cron solapados mientras se itera sobre los usuarios */
  private isRunning = false;

  constructor(
    private readonly prisma:       PrismaService,
    private readonly encryption:   EncryptionService,
    private readonly webhooks:     WebhooksService,
    private readonly transactions: TransactionsService,
  ) {}

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  async onModuleDestroy() {
    this.isRunning = false;
  }

  // ── Cron: cada 30 segundos ───────────────────────────────────────────────────

  @Cron('*/30 * * * * *')
  async checkEmails(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('[email-ingestion] Tick solapado detectado — omitiendo ciclo.');
      return;
    }

    const integrations = await this.prisma.emailIntegration.findMany();

    if (integrations.length === 0) return;

    this.isRunning = true;

    try {
      for (const integration of integrations) {
        const cfg: ImapConfig = {
          host:     integration.emailHost,
          port:     integration.emailPort,
          user:     integration.emailUser,
          password: this.encryption.decrypt(integration.emailPassword),
          mailbox:  integration.emailMailbox,
          tls:      true,
        };

        await this.checkEmailsForUser(cfg, integration.userId);
      }
    } finally {
      this.isRunning = false;
    }
  }

  /** Procesa la bandeja IMAP de un usuario específico */
  private async checkEmailsForUser(cfg: ImapConfig, userId: string): Promise<void> {
    const client = new ImapFlow({
      host:   cfg.host,
      port:   cfg.port,
      secure: cfg.tls,
      auth: { user: cfg.user, pass: cfg.password },
      logger: false,
    });

    try {
      await client.connect();
      this.logger.verbose(`[email-ingestion] [${cfg.user}] Conectado a ${cfg.host}:${cfg.port}`);

      const mailbox = await client.mailboxOpen(cfg.mailbox);
      this.logger.verbose(`[email-ingestion] [${cfg.user}] Buzón "${cfg.mailbox}" — ${mailbox.exists} mensajes`);

      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const searchResult = await client.search({ seen: false, since: since24h }, { uid: true });
      const uids: number[] = Array.isArray(searchResult) ? searchResult : [];

      if (uids.length === 0) {
        this.logger.verbose(`[email-ingestion] [${cfg.user}] Sin mensajes nuevos.`);
        return;
      }

      this.logger.log(`[email-ingestion] [${cfg.user}] ${uids.length} mensaje(s) no-leído(s)`);

      for (const uid of uids) {
        await this.processEmail(client, uid, cfg);
      }

    } catch (err) {
      this.logger.error(`[email-ingestion] [${cfg.user}] Error durante la ingesta:`, err);
    } finally {
      try { await client.logout(); } catch (_) {}
    }
  }

  // ── Procesamiento de un correo ───────────────────────────────────────────────

  private async processEmail(
    client:  InstanceType<typeof ImapFlow>,
    uid:     number,
    cfg:     ImapConfig,
  ): Promise<void> {
    try {
      // Descargar el mensaje completo en formato source (RFC 2822 raw).
      // { uid: true } porque el uid recibido es un UID real (no número de secuencia).
      const message = await client.fetchOne(String(uid), { source: true }, { uid: true });

      if (!message) return;

      // ── Marcar como LEÍDO antes de cualquier procesamiento ──────────────
      // Esto previene que el próximo tick del cron vuelva a procesar el mismo
      // email si la creación de transacciones tarda más de 30 s o falla a mitad.
      // Es preferible perder un registro puntual que generar duplicados.
      await client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true });

      // ── Extraer remitente del source raw para filtro temprano ───────────
      const rawSource   = message.source?.toString('utf8') ?? '';
      // Los emails de Gmail llevan muchos headers SMTP antes del From: (Received,
      // DKIM-Signature, ARC-Seal, etc.). Usar la sección de cabeceras completa
      // en lugar de un slice fijo de N chars, para no cortar antes del From:.
      const headerBound = rawSource.indexOf('\r\n\r\n');
      const headerBlock = headerBound !== -1 ? rawSource.slice(0, headerBound) : rawSource.slice(0, 8000);
      const fromHeader  = this.extractHeader(headerBlock, 'from');
      const isBankEmail = this.isBankSender(fromHeader);

      if (!isBankEmail) return;

      // ── Extraer cuerpo texto-plano ──────────────────────────────────────
      const textBody = this.extractPlainText(rawSource);

      if (!textBody || textBody.trim().length < 10) {
        this.logger.verbose(`[email-ingestion] UID ${uid}: cuerpo vacío o muy corto — omitido`);
        return;
      }

      this.logger.verbose(
        `[email-ingestion] UID ${uid} | from: ${fromHeader.slice(0, 60)} | body: "${textBody.slice(0, 80)}…"`,
      );

      // ── Detectar proveedor y sufijo de cuenta (una vez por email) ────────
      const baseInfo = this.webhooks.parseText(textBody);

      if (!baseInfo.provider) {
        this.logger.verbose(`[email-ingestion] UID ${uid}: proveedor no reconocido — skip`);
        return;
      }

      const provider = baseInfo.provider as 'NEQUI' | 'BANCOLOMBIA';

      // Suplemento para emails de Bancolombia: extrae sufijo de cuenta del cuerpo del email
      let accountSuffix = baseInfo.accountSuffix;
      if (!accountSuffix && provider === 'BANCOLOMBIA') {
        const emailSuffix =
          textBody.match(/(?:desde\s+tu\s+cuenta|cuenta\s+origen)\s+(\d{4})/i) ??
          textBody.match(/\bcuenta\s+(\d{4})\b/i) ??
          textBody.match(/\*(\d{4})\b/);
        if (emailSuffix) accountSuffix = emailSuffix[1];
      }
      this.logger.verbose(`[email-ingestion] UID ${uid} | provider=${provider} suffix=${accountSuffix} body="${textBody.slice(0, 120)}…"`);

      // ── Buscar cuenta bancaria en BD ─────────────────────────────────────
      const account = await this.resolveAccount(provider, accountSuffix);

      if (!account) {
        this.logger.warn(
          `[email-ingestion] UID ${uid}: cuenta ${provider} *${accountSuffix ?? '????'} no encontrada — omitido`,
        );
        return;
      }

      // ── Extraer TODAS las transacciones del email ─────────────────────────
      // Un solo email puede contener varios movimientos apilados verticalmente.
      // Buscamos cada ocurrencia de "$monto" y determinamos INCOME/EXPENSE
      // mirando la ventana de texto circundante de cada una.
      const txItems = this.extractAllTransactions(textBody);

      if (txItems.length === 0) {
        this.logger.verbose(`[email-ingestion] UID ${uid}: ningún monto con tipo reconocible — skip`);
        return;
      }

      // ── Upsert de categoría ──────────────────────────────────────────────
      const categoryName = provider === 'NEQUI' ? 'Nequi' : 'Bancolombia';
      const category     = await this.upsertCategory(account.userId, categoryName);

      // ── Crear una transacción por cada monto detectado ───────────────────
      const descBase = `[Email] ${textBody.slice(0, 150)}${textBody.length > 150 ? '…' : ''}`;

      for (const item of txItems) {
        await this.transactions.createForWebhook({
          bankAccountId: account.id,
          categoryId:    category.id,
          userId:        account.userId,
          amount:        item.amount,
          type:          item.type,
          description:   descBase,
          date:          new Date(),
        });

        this.logger.log(
          `[email-ingestion] ✓ UID ${uid} | ${provider} ${item.type} $${item.amount.toLocaleString('es-CO')} → "${account.name}"`,
        );
      }

    } catch (err) {
      this.logger.error(`[email-ingestion] Error procesando UID ${uid}:`, err);
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  /**
   * Filtro de remitente: solo procesa correos cuyo "From" contiene
   * dominios oficiales de Nequi o Bancolombia.
   */
  private isBankSender(from: string): boolean {
    const BANK_DOMAINS = [
      'nequi.com.co',
      'bancolombia.com.co',
      'bancolombia.com',
      'notificaciones.bancolombia.com',
      'notificacionesbancolombia.com',   // an.notificacionesbancolombia.com
      'alertas.bancolombia.com',
      'alertasynotificaciones',           // alertasynotificaciones@...
    ];
    const lower = from.toLowerCase();
    return BANK_DOMAINS.some(domain => lower.includes(domain));
  }

  /**
   * Extrae el cuerpo texto-plano de un mensaje raw RFC 2822.
   *
   * Estrategia (en orden de prioridad):
   *  1. Busca la parte text/plain en un mensaje multipart.
   *  2. Si no hay multipart, extrae el body completo tras las cabeceras.
   *  3. Decodifica Base64 o Quoted-Printable si corresponde.
   */
  private extractPlainText(raw: string): string {
    const headerBodySep = raw.indexOf('\r\n\r\n');
    const headerSection = headerBodySep !== -1 ? raw.slice(0, headerBodySep) : '';
    const bodySection   = headerBodySep !== -1 ? raw.slice(headerBodySep + 4) : raw;

    const contentType = this.extractHeader(headerSection, 'content-type');

    // ── Mensaje multipart ───────────────────────────────────────────────────
    if (/multipart/i.test(contentType)) {
      const boundaryMatch = contentType.match(/boundary="?([^";\r\n]+)"?/i);
      if (boundaryMatch) {
        const boundary = boundaryMatch[1].trim();
        const parts    = bodySection.split(new RegExp(`--${this.escapeRegex(boundary)}`, 'g'));

        let htmlFallback = '';

        for (const part of parts) {
          const partSep = part.indexOf('\r\n\r\n');
          if (partSep === -1) continue;

          const partHeaders = part.slice(0, partSep);
          const partBody    = part.slice(partSep + 4);
          const partType    = this.extractHeader(partHeaders, 'content-type');
          const encoding    = this.extractHeader(partHeaders, 'content-transfer-encoding');

          if (/text\/plain/i.test(partType)) {
            return this.decodeBody(partBody, encoding).replace(/\r\n/g, '\n').trim();
          }
          if (/text\/html/i.test(partType) && !htmlFallback) {
            htmlFallback = this.decodeBody(partBody, encoding);
          }
        }

        // No había text/plain — usar el HTML decodificado y quitar los tags
        if (htmlFallback) return this.stripHtml(htmlFallback);
      }
    }

    // ── Mensaje simple ─────────────────────────────────────────────────────
    if (/text\/plain/i.test(contentType) || contentType === '') {
      const encoding = this.extractHeader(headerSection, 'content-transfer-encoding');
      return this.decodeBody(bodySection, encoding).replace(/\r\n/g, '\n').trim();
    }

    if (/text\/html/i.test(contentType)) {
      const encoding = this.extractHeader(headerSection, 'content-transfer-encoding');
      return this.stripHtml(this.decodeBody(bodySection, encoding));
    }

    // Último recurso: quitar tags del body en bruto
    return this.stripHtml(bodySection);
  }

  /** Elimina tags HTML y decodifica entidades básicas para obtener texto plano */
  private stripHtml(html: string): string {
    return html
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/td>/gi, ' ')
      .replace(/<\/tr>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /** Lee el valor de una cabecera específica (case-insensitive).
   *  Primero desdobla headers multi-línea (RFC 2822 folding: CRLF + espacio/tab). */
  private extractHeader(headers: string, name: string): string {
    // Desdoblar: CRLF seguido de whitespace → un espacio (RFC 2822 §2.2.3)
    const unfolded = headers.replace(/\r\n([ \t])/g, ' ');
    const re       = new RegExp(`^${name}:\\s*(.+)$`, 'im');
    const match    = unfolded.match(re);
    return match ? match[1].trim() : '';
  }

  /** Decodifica un body según el Content-Transfer-Encoding declarado */
  private decodeBody(body: string, encoding: string): string {
    const enc = encoding.toLowerCase().trim();

    if (enc === 'base64') {
      try {
        return Buffer.from(body.replace(/\s/g, ''), 'base64').toString('utf8');
      } catch (_) {
        return body;
      }
    }

    if (enc === 'quoted-printable') {
      // Elimina soft line breaks (=\r\n), luego recoge todos los bytes
      // y los decodifica como UTF-8. String.fromCharCode solo funciona para
      // Latin-1; los emails reales de Bancolombia usan UTF-8 multi-byte (=C2=A1 etc.)
      const withoutSoftBreaks = body.replace(/=\r?\n/g, '');
      const bytes: number[] = [];
      let i = 0;
      while (i < withoutSoftBreaks.length) {
        if (withoutSoftBreaks[i] === '=' && i + 2 < withoutSoftBreaks.length) {
          bytes.push(parseInt(withoutSoftBreaks.slice(i + 1, i + 3), 16));
          i += 3;
        } else {
          bytes.push(withoutSoftBreaks.charCodeAt(i));
          i++;
        }
      }
      return Buffer.from(bytes).toString('utf8');
    }

    return body; // 7bit / 8bit / binary → sin transformación
  }

  /** Escapa caracteres especiales de regex para usarlos en new RegExp() */
  private escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Busca la cuenta bancaria en la BD según proveedor y sufijo de cuenta.
   * Reutiliza la misma lógica de WebhooksService.handleMobileParser.
   */
  private async resolveAccount(
    provider:      'NEQUI' | 'BANCOLOMBIA' | null,
    accountSuffix: string | null,
  ) {
    if (!provider) return null;

    if (provider === 'BANCOLOMBIA') {
      // Primero intenta match exacto por sufijo de cuenta
      if (accountSuffix) {
        const byId = await this.prisma.bankAccount.findFirst({
          where: {
            provider:          'BANCOLOMBIA',
            externalAccountId: { endsWith: accountSuffix },
          },
          select: { id: true, userId: true, name: true },
        });
        if (byId) return byId;
      }
      // Fallback: primera cuenta Bancolombia disponible
      return this.prisma.bankAccount.findFirst({
        where:   { provider: 'BANCOLOMBIA' },
        select:  { id: true, userId: true, name: true },
        orderBy: { createdAt: 'asc' },
      });
    }

    // NEQUI: sin sufijo de cuenta en los emails (a diferencia de SMS donde viene
    // el número del teléfono). Usamos la primera cuenta Nequi del usuario.
    // Si hay múltiples cuentas Nequi el operador debe configurar reglas adicionales.
    return this.prisma.bankAccount.findFirst({
      where:  { provider: 'NEQUI' },
      select: { id: true, userId: true, name: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Crea o recupera una categoría con el nombre del banco para el usuario dado.
   * Mismo helper que usa WebhooksService internamente.
   */
  private async upsertCategory(userId: string, name: string) {
    return this.prisma.category.upsert({
      where:  { name_userId: { name, userId } },
      update: {},
      create: { userId, name },
    });
  }

  /**
   * Encuentra TODOS los montos ($X) en el texto del email y determina el tipo
   * de cada transacción mirando la ventana de texto que rodea cada monto.
   *
   * Permite procesar emails de resumen de Bancolombia/Nequi que incluyen
   * varios movimientos apilados en un solo mensaje.
   */
  private extractAllTransactions(
    text: string,
  ): Array<{ amount: number; type: Extract<TransactionType, 'INCOME' | 'EXPENSE'> }> {
    const results: Array<{ amount: number; type: Extract<TransactionType, 'INCOME' | 'EXPENSE'> }> = [];
    const amountRe = /\$\s?([\d.,]+)/g;
    let match: RegExpExecArray | null;

    while ((match = amountRe.exec(text)) !== null) {
      const amount = this.webhooks.parseAmount(match[1]);
      if (!amount || amount <= 0) continue;

      // Ventana de contexto: 250 chars antes (para capturar la oración que describe
      // la acción) y 80 después del símbolo "$" (por si el verbo viene después).
      const start   = Math.max(0, match.index - 250);
      const end     = Math.min(text.length, match.index + 80);
      const context = text.slice(start, end);

      const type = this.detectTransactionType(context);
      if (!type) continue;

      results.push({ amount, type });
    }

    return results;
  }

  /** Determina EXPENSE o INCOME según las palabras clave en el contexto del monto */
  private detectTransactionType(
    context: string,
  ): Extract<TransactionType, 'INCOME' | 'EXPENSE'> | null {
    if (/compra|retiro|pago\s|pagaste|enviaste|transferiste|d[eé]bito|debit/i.test(context)) {
      return 'EXPENSE';
    }
    if (/recib(?:i[oó]|iste)|abono|consignaci[oó]n|te\s+enviaron|transferencia\s+recib/i.test(context)) {
      return 'INCOME';
    }
    return null;
  }
}
