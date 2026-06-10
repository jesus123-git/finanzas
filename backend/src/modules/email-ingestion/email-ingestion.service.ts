/**
 * EmailIngestionService
 *
 * Motor de ingesta de correos bancarios (Nequi / Bancolombia).
 *
 * Flujo:
 *  1. Cron cada 30 segundos.
 *  2. Conecta por IMAP al buzón configurado en variables de entorno.
 *  3. Busca mensajes no-leídos del día actual.
 *  4. Para cada mensaje extrae el cuerpo en texto-plano.
 *  5. Pasa el texto al motor de regex de WebhooksService (parseText).
 *  6. Si reconoce proveedor + monto → busca la cuenta bancaria en BD.
 *  7. Crea la transacción usando el mismo TransactionsService que usan los webhooks SMS.
 *  8. Marca el mensaje como LEÍDO para evitar duplicados.
 *
 * Variables de entorno necesarias (todas opcionales — el servicio queda inactivo
 * si EMAIL_HOST no está definido):
 *   EMAIL_HOST      — servidor IMAP (ej: imap.gmail.com)
 *   EMAIL_PORT      — puerto IMAP (default: 993)
 *   EMAIL_USER      — correo electrónico
 *   EMAIL_PASSWORD  — contraseña o contraseña de aplicación
 *   EMAIL_MAILBOX   — buzón (default: INBOX)
 */

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { WebhooksService } from '../webhooks/webhooks.service';
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

  /** Cliente IMAP activo durante el tick del cron. Se cierra al finalizar. */
  private activeClient: InstanceType<typeof ImapFlow> | null = null;

  constructor(
    private readonly config:       ConfigService,
    private readonly prisma:       PrismaService,
    private readonly webhooks:     WebhooksService,
    private readonly transactions: TransactionsService,
  ) {}

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  async onModuleDestroy() {
    if (this.activeClient) {
      try { await this.activeClient.logout(); } catch (_) {}
      this.activeClient = null;
    }
  }

  // ── Cron: cada 30 segundos ───────────────────────────────────────────────────

  @Cron('*/30 * * * * *')
  async checkEmails(): Promise<void> {
    const cfg = this.loadConfig();

    // Si EMAIL_HOST no está configurado el módulo permanece inactivo en silencio.
    if (!cfg) return;

    // Evita tick solapado: si el cliente anterior aún está abierto, saltar.
    if (this.activeClient) {
      this.logger.warn('[email-ingestion] Tick solapado detectado — omitiendo ciclo.');
      return;
    }

    const client = new ImapFlow({
      host:   cfg.host,
      port:   cfg.port,
      secure: cfg.tls,
      auth: {
        user: cfg.user,
        pass: cfg.password,
      },
      // Silenciar el logger interno de imapflow — usamos el de NestJS
      logger: false,
    });

    this.activeClient = client;

    try {
      await client.connect();
      this.logger.verbose(`[email-ingestion] Conectado a ${cfg.host}:${cfg.port}`);

      // Abre el buzón en modo read-write para poder marcar mensajes
      const mailbox = await client.mailboxOpen(cfg.mailbox);
      this.logger.verbose(`[email-ingestion] Buzón "${cfg.mailbox}" abierto — ${mailbox.exists} mensajes`);

      // Buscar no-leídos de las últimas 24h (no solo desde medianoche,
      // para no perder emails nocturnos del día anterior)
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const searchResult = await client.search({ seen: false, since: since24h });
      const uids: number[] = Array.isArray(searchResult) ? searchResult : [];

      if (uids.length === 0) {
        this.logger.verbose('[email-ingestion] Sin mensajes nuevos.');
        return;
      }

      this.logger.log(`[email-ingestion] ${uids.length} mensaje(s) no-leído(s) encontrado(s)`);

      for (const uid of uids) {
        await this.processEmail(client, uid, cfg);
      }

    } catch (err) {
      this.logger.error('[email-ingestion] Error durante la ingesta:', err);
    } finally {
      try { await client.logout(); } catch (_) {}
      this.activeClient = null;
    }
  }

  // ── Procesamiento de un correo ───────────────────────────────────────────────

  private async processEmail(
    client:  InstanceType<typeof ImapFlow>,
    uid:     number,
    cfg:     ImapConfig,
  ): Promise<void> {
    try {
      // Descargar el mensaje completo en formato source (RFC 2822 raw)
      const message = await client.fetchOne(String(uid), { source: true });

      if (!message) return;

      // ── Extraer remitente del source raw para filtro temprano ───────────
      const rawSource  = message.source?.toString('utf8') ?? '';
      const fromHeader = this.extractHeader(rawSource.slice(0, 2000), 'from');
      const isBankEmail = this.isBankSender(fromHeader);

      if (!isBankEmail) {
        // Marcar como leído para no volver a procesarlo en futuros ticks
        await client.messageFlagsAdd({ uid: String(uid) }, ['\\Seen']);
        return;
      }

      // ── Extraer cuerpo texto-plano ──────────────────────────────────────
      const textBody = this.extractPlainText(rawSource);

      if (!textBody || textBody.trim().length < 10) {
        this.logger.verbose(`[email-ingestion] UID ${uid}: cuerpo vacío o muy corto — omitido`);
        await client.messageFlagsAdd({ uid: String(uid) }, ['\\Seen']);
        return;
      }

      this.logger.verbose(
        `[email-ingestion] UID ${uid} | from: ${fromHeader.slice(0, 60)} | body: "${textBody.slice(0, 80)}…"`,
      );

      // ── Parsear con el motor de regex de WebhooksService ────────────────
      const parsed = this.webhooks.parseText(textBody);

      // Suplemento para emails de Bancolombia: "desde tu cuenta XXXX" (sin asterisco)
      // Los SMS usan *XXXX pero los emails de notificación usan "cuenta XXXX".
      if (!parsed.accountSuffix && parsed.provider === 'BANCOLOMBIA') {
        const emailSuffix = textBody.match(/(?:desde\s+tu\s+cuenta|cuenta\s+origen)\s+(\d{4})(?!\d)/i);
        if (emailSuffix) parsed.accountSuffix = emailSuffix[1];
      }

      if (!parsed.provider || !parsed.type || !parsed.amount || parsed.amount <= 0) {
        this.logger.verbose(
          `[email-ingestion] UID ${uid}: no reconocido como transacción bancaria — skip`,
        );
        // NO marcamos como leído: puede ser un email de banco no-transaccional
        // (p.ej. avisos de seguridad). El operador puede decidir borrarlo.
        // Marcamos para no reprocesarlo en este ciclo
        await client.messageFlagsAdd({ uid: String(uid) }, ['\\Seen']);
        return;
      }

      // ── Buscar cuenta bancaria en BD ─────────────────────────────────────
      const account = await this.resolveAccount(parsed.provider, parsed.accountSuffix);

      if (!account) {
        this.logger.warn(
          `[email-ingestion] UID ${uid}: cuenta ${parsed.provider} *${parsed.accountSuffix ?? '????'} no encontrada — omitido`,
        );
        await client.messageFlagsAdd({ uid: String(uid) }, ['\\Seen']);
        return;
      }

      // ── Upsert de categoría ──────────────────────────────────────────────
      const categoryName = parsed.provider === 'NEQUI' ? 'Nequi' : 'Bancolombia';
      const category     = await this.upsertCategory(account.userId, categoryName);

      // ── Crear transacción ────────────────────────────────────────────────
      const description = `[Email] ${textBody.slice(0, 197)}${textBody.length > 197 ? '…' : ''}`;

      await this.transactions.createForWebhook({
        bankAccountId: account.id,
        categoryId:    category.id,
        userId:        account.userId,
        amount:        parsed.amount,
        type:          parsed.type as Extract<TransactionType, 'INCOME' | 'EXPENSE'>,
        description,
        date:          new Date(),
      });

      this.logger.log(
        `[email-ingestion] ✓ UID ${uid} | ${parsed.provider} ${parsed.type} $${parsed.amount.toLocaleString('es-CO')} → "${account.name}"`,
      );

      // ── Marcar como LEÍDO para evitar duplicados ─────────────────────────
      await client.messageFlagsAdd({ uid: String(uid) }, ['\\Seen']);

    } catch (err) {
      this.logger.error(`[email-ingestion] Error procesando UID ${uid}:`, err);
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  /**
   * Carga la configuración IMAP desde variables de entorno.
   * Devuelve null si EMAIL_HOST no está definido → el servicio queda inactivo.
   */
  private loadConfig(): ImapConfig | null {
    const host = this.config.get<string>('EMAIL_HOST');
    if (!host) return null;

    return {
      host,
      port:     parseInt(this.config.get<string>('EMAIL_PORT') ?? '993', 10),
      user:     this.config.get<string>('EMAIL_USER')     ?? '',
      password: this.config.get<string>('EMAIL_PASSWORD') ?? '',
      mailbox:  this.config.get<string>('EMAIL_MAILBOX')  ?? 'INBOX',
      tls:      (this.config.get<string>('EMAIL_TLS') ?? 'true') !== 'false',
    };
  }

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
    // ── Separar cabeceras del cuerpo ────────────────────────────────────────
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

        for (const part of parts) {
          const partSep = part.indexOf('\r\n\r\n');
          if (partSep === -1) continue;

          const partHeaders = part.slice(0, partSep);
          const partBody    = part.slice(partSep + 4);
          const partType    = this.extractHeader(partHeaders, 'content-type');

          if (/text\/plain/i.test(partType)) {
            const encoding = this.extractHeader(partHeaders, 'content-transfer-encoding');
            return this.decodeBody(partBody, encoding).replace(/\r\n/g, '\n').trim();
          }
        }
      }
    }

    // ── Mensaje simple (text/plain directo) ────────────────────────────────
    if (/text\/plain/i.test(contentType) || contentType === '') {
      const encoding = this.extractHeader(headerSection, 'content-transfer-encoding');
      return this.decodeBody(bodySection, encoding).replace(/\r\n/g, '\n').trim();
    }

    // Fallback: devolver body en bruto (puede ser HTML)
    return bodySection.replace(/\r\n/g, '\n').trim();
  }

  /** Lee el valor de una cabecera específica (case-insensitive) */
  private extractHeader(headers: string, name: string): string {
    const re    = new RegExp(`^${name}:\\s*(.+)$`, 'im');
    const match = headers.match(re);
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
      if (!accountSuffix) return null;
      return this.prisma.bankAccount.findFirst({
        where: {
          provider:          'BANCOLOMBIA',
          externalAccountId: { endsWith: accountSuffix },
        },
        select: { id: true, userId: true, name: true },
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
}
