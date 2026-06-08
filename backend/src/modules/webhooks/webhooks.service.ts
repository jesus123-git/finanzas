import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { TransactionType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TransactionsService } from '../transactions/transactions.service';
import { NequiWebhookPayloadDto } from './dto/nequi-webhook-payload.dto';
import { BancolombiaWebhookPayloadDto } from './dto/bancolombia-webhook-payload.dto';
import { MobileParserPayloadDto } from './dto/mobile-parser-payload.dto';

// ─── Tipos internos ───────────────────────────────────────────────────────────

interface ResolvedAccount {
  id:     string;
  userId: string;
  name:   string;
}

/** Resultado del motor de parsing de SMS/notificaciones bancarias */
interface ParsedSMS {
  provider:      'NEQUI' | 'BANCOLOMBIA' | null;
  type:          'INCOME' | 'EXPENSE' | null;
  amount:        number | null;
  /** Últimos 4 dígitos de la cuenta (solo Bancolombia) */
  accountSuffix: string | null;
}

// ─── Servicio ─────────────────────────────────────────────────────────────────

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  /**
   * Marca de tiempo del último webhook procesado con éxito.
   * El frontend hace polling a GET /webhooks/ping y compara este valor
   * para detectar cambios y ejecutar un refetch automático.
   * Se inicializa en el momento de arranque del servidor.
   */
  private lastEventAt: Date = new Date();

  constructor(
    private readonly prisma:       PrismaService,
    private readonly transactions: TransactionsService,
  ) {}

  // ── Ping / Last Event ────────────────────────────────────────────────────────

  /** Devuelve el timestamp del último webhook procesado. Sin autenticación. */
  getLastEventAt(): { lastEventAt: string } {
    return { lastEventAt: this.lastEventAt.toISOString() };
  }

  // ── Handler Nequi ─────────────────────────────────────────────────────────

  async handleNequi(payload: NequiWebhookPayloadDto) {
    const account  = await this.resolveAccount('NEQUI', payload.phoneNumber, 'phoneNumber');
    const category = await this.upsertCategory(account.userId, 'Nequi');

    const transaction = await this.transactions.createForWebhook({
      bankAccountId: account.id,
      categoryId:    category.id,
      userId:        account.userId,
      amount:        payload.amount,
      type:          payload.type,
      description:   payload.description,
      date:          new Date(payload.timestamp),
    });

    this.emitRefreshEvent();
    return { ok: true, provider: 'NEQUI', accountName: account.name, transaction };
  }

  // ── Handler Bancolombia ──────────────────────────────────────────────────

  async handleBancolombia(payload: BancolombiaWebhookPayloadDto) {
    const account  = await this.resolveAccount('BANCOLOMBIA', payload.accountNumber, 'accountNumber');
    const category = await this.upsertCategory(account.userId, 'Bancolombia');

    const transaction = await this.transactions.createForWebhook({
      bankAccountId: account.id,
      categoryId:    category.id,
      userId:        account.userId,
      amount:        payload.amount,
      type:          payload.type,
      description:   payload.description,
      date:          new Date(payload.timestamp),
    });

    this.emitRefreshEvent();
    return { ok: true, provider: 'BANCOLOMBIA', accountName: account.name, transaction };
  }

  // ── Handler Mobile Parser ────────────────────────────────────────────────
  //
  // Recibe el texto crudo de un SMS o notificación bancaria desde iOS Shortcuts
  // o MacroDroid (Android) y lo procesa sin conocimiento previo de su formato.
  // Tolerante a fallos: si no puede extraer algún campo, registra el motivo
  // en el log y retorna un mensaje descriptivo sin lanzar excepción.

  async handleMobileParser(payload: MobileParserPayloadDto): Promise<{
    ok:           boolean;
    message:      string;
    accountName?: string;
    provider?:    string;
    type?:        string;
    amount?:      number;
  }> {
    const { text, devicePhone } = payload;

    // ── 0. Guardia de seguridad temprana ──────────────────────────────────
    // Protege contra inputs inesperados que pasen la validación del DTO pero
    // puedan romper las expresiones regulares o los métodos de string.
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      this.logger.warn('[mobile-parser] Campo "text" vacío o inválido — rechazando.');
      return { ok: false, message: 'El campo "text" es obligatorio y no puede estar vacío' };
    }

    this.logger.log(
      `[mobile-parser] Texto recibido (${text.length} chars): "${text.slice(0, 100)}${text.length > 100 ? '…' : ''}"`,
    );

    // ── 1. Parsear el texto ────────────────────────────────────────────────
    // Envuelto en try-catch: si una regex lanza con un encoding inesperado
    // (p.ej. secuencias de bytes inválidas desde ciertos dispositivos Android),
    // devolvemos 200 con ok:false en lugar de romper la conexión HTTP.
    let parsed: ParsedSMS;
    try {
      parsed = this.parseText(text);
    } catch (parseErr) {
      this.logger.error('[mobile-parser] Excepción en parseText — texto posiblemente malformado:', parseErr);
      return { ok: false, message: 'No se pudo analizar el texto del SMS (encoding o formato inesperado)' };
    }

    if (!parsed.provider) {
      this.logger.warn('[mobile-parser] Proveedor no reconocido — el texto no menciona "Bancolombia" ni "Nequi".');
      return { ok: false, message: 'Proveedor no reconocido (el texto debe contener "Bancolombia" o "Nequi")' };
    }
    if (!parsed.type) {
      this.logger.warn(`[mobile-parser] Tipo de movimiento no reconocido en texto de ${parsed.provider}.`);
      return { ok: false, message: `Tipo de movimiento no reconocido en el texto de ${parsed.provider}` };
    }
    if (!parsed.amount || parsed.amount <= 0) {
      this.logger.warn(`[mobile-parser] Monto no encontrado en texto de ${parsed.provider}.`);
      return { ok: false, message: 'No se pudo extraer el monto del texto (¿falta el símbolo "$"?)' };
    }

    // ── 2. Buscar la cuenta en la BD ──────────────────────────────────────
    // try-catch independiente: aísla errores de Prisma (conexión caída,
    // timeout, esquema desincronizado) del flujo normal de negocio.
    let account: ResolvedAccount | null = null;
    try {
      if (parsed.provider === 'NEQUI') {
        // Para Nequi: el identificador es el número de teléfono del dispositivo.
        account = await this.prisma.bankAccount.findFirst({
          where:  { provider: 'NEQUI', externalAccountId: devicePhone },
          select: { id: true, userId: true, name: true },
        });
        if (!account) {
          this.logger.warn(`[mobile-parser] Cuenta NEQUI no encontrada para devicePhone=${devicePhone}`);
          return {
            ok:      false,
            message: `Cuenta NEQUI con número ${devicePhone} no encontrada — créala con provider=NEQUI`,
          };
        }
      } else {
        // Para Bancolombia: identificador = últimos 4 dígitos de la cuenta.
        if (!parsed.accountSuffix) {
          this.logger.warn('[mobile-parser] Bancolombia: sufijo de cuenta (*XXXX) no encontrado en el texto.');
          return { ok: false, message: 'No se encontraron los últimos 4 dígitos de la cuenta Bancolombia en el texto' };
        }
        account = await this.prisma.bankAccount.findFirst({
          where: {
            provider:          'BANCOLOMBIA',
            externalAccountId: { endsWith: parsed.accountSuffix },
          },
          select: { id: true, userId: true, name: true },
        });
        if (!account) {
          this.logger.warn(`[mobile-parser] Cuenta BANCOLOMBIA *${parsed.accountSuffix} no encontrada.`);
          return {
            ok:      false,
            message: `Cuenta BANCOLOMBIA *${parsed.accountSuffix} no encontrada — créala con el número de cuenta completo`,
          };
        }
      }
    } catch (dbLookupErr) {
      this.logger.error('[mobile-parser] Error al consultar la cuenta en BD:', dbLookupErr);
      return { ok: false, message: 'Error interno al consultar la base de datos — reintenta en unos segundos' };
    }

    // ── 3. Upsert de categoría y creación de transacción ──────────────────
    // try-catch independiente: protege contra fallos de escritura en BD
    // (p.ej. constraint violation, conexión perdida durante la transacción).
    try {
      const categoryName = parsed.provider === 'NEQUI' ? 'Nequi' : 'Bancolombia';
      const category     = await this.upsertCategory(account.userId, categoryName);

      // Descripción: primeros 200 chars del SMS
      const description = text.length > 200 ? `${text.slice(0, 197)}…` : text;

      await this.transactions.createForWebhook({
        bankAccountId: account.id,
        categoryId:    category.id,
        userId:        account.userId,
        amount:        parsed.amount,
        type:          parsed.type as Extract<TransactionType, 'INCOME' | 'EXPENSE'>,
        description,
        date:          new Date(),
      });
    } catch (txErr) {
      this.logger.error('[mobile-parser] Error al crear la transacción:', txErr);
      return { ok: false, message: 'Error al guardar la transacción — el balance no fue modificado' };
    }

    // ── 4. Marcar evento de refresco ──────────────────────────────────────
    this.emitRefreshEvent();

    this.logger.log(
      `[mobile-parser] ✓ ${parsed.provider} ${parsed.type} $${parsed.amount.toLocaleString('es-CO')} → "${account.name}"`,
    );

    return {
      ok:          true,
      message:     'Transacción procesada y balance actualizado',
      accountName: account.name,
      provider:    parsed.provider,
      type:        parsed.type,
      amount:      parsed.amount,
    };
  }

  // ── Helpers privados ─────────────────────────────────────────────────────

  /**
   * Motor de parsing de SMS bancarios colombianos.
   *
   * Diseñado para ser tolerante a fallos: nunca lanza excepción,
   * devuelve null en los campos que no pudo extraer.
   *
   * Ejemplos de textos reales que reconoce:
   *   Bancolombia: "Bancolombia: Compra por $45.000 en EXITO Cta *5678"
   *   Nequi:       "¡Plata! Recibiste $200.000 de Juan P."
   *   Nequi:       "Nequi: Enviaste $15.000 a Maria L."
   *   Bancolombia: "Retiro Cajero $80.000 Cta Ahorros *1234"
   */
  private parseText(text: string): ParsedSMS {
    // ── Proveedor ─────────────────────────────────────────────────────────
    let provider: 'NEQUI' | 'BANCOLOMBIA' | null = null;
    if (/bancolombia/i.test(text))  provider = 'BANCOLOMBIA';
    else if (/nequi/i.test(text))   provider = 'NEQUI';
    // ¡Plata! es el formato de notificación push de Nequi sin la palabra "Nequi"
    else if (/¡plata!/i.test(text)) provider = 'NEQUI';

    // ── Tipo de movimiento ────────────────────────────────────────────────
    //
    // EXPENSE se evalúa primero porque palabras como "pago" pueden aparecer en
    // mensajes de ingreso (ej: "recibiste el pago de"). El orden importa.
    let type: 'INCOME' | 'EXPENSE' | null = null;

    const EXPENSE_RE = /compra|retiro|pago\s|pagaste|enviaste|d[eé]bito|debit/i;
    const INCOME_RE  = /recib(?:i[oó]|iste)|abono|consignaci[oó]n|te\s+enviaron|¡plata.*recib|transferencia\s+recib/i;

    if (EXPENSE_RE.test(text))     type = 'EXPENSE';
    else if (INCOME_RE.test(text)) type = 'INCOME';

    // ── Monto ─────────────────────────────────────────────────────────────
    // Captura el valor que sigue a '$', incluyendo separadores de miles.
    // Formato colombiano: $1.234.567 (puntos = miles, sin decimales).
    // También acepta formato inglés: $45,000 o $45,000.00.
    let amount: number | null = null;
    const amountMatch = text.match(/\$\s?([\d.,]+)/);
    if (amountMatch) {
      amount = this.parseAmount(amountMatch[1]);
    }

    // ── Sufijo de cuenta Bancolombia ──────────────────────────────────────
    // Reconoce patrones: "Cta *5678", "cuenta *5678", "Cta. *5678",
    //                    "Cta Ahorros *5678", "cta *0001"
    let accountSuffix: string | null = null;
    const suffixMatch = text.match(/cta\.?(?:\s+\w+)?\s*\*(\d{4})/i)
                     ?? text.match(/cuenta\s*\*(\d{4})/i);
    if (suffixMatch) accountSuffix = suffixMatch[1];

    return { provider, type, amount, accountSuffix };
  }

  /**
   * Convierte una cadena de monto en número entero sin decimales.
   *
   * Maneja los formatos:
   *   - Colombiano:  "45.000"  → 45000   "1.234.567" → 1234567
   *   - Inglés:      "45,000"  → 45000   "45,000.00" → 45000
   *   - Mixto:       "1.234,00"→ 1234    "1,234.00"  → 1234
   */
  private parseAmount(raw: string): number {
    // Guardia defensiva: si raw no es un string o está vacío, devuelve 0.
    if (!raw || typeof raw !== 'string') return 0;
    const s        = raw.trim();
    if (s.length === 0) return 0;
    const lastDot  = s.lastIndexOf('.');
    const lastComma = s.lastIndexOf(',');

    let cleaned: string;

    if (lastDot !== -1 && lastComma !== -1) {
      // Ambos separadores presentes → el último es el decimal
      if (lastDot > lastComma) {
        // Inglés: 1,234.00 — punto es decimal, coma es miles
        cleaned = s.slice(0, lastDot).replace(/,/g, '');
      } else {
        // Europeo: 1.234,00 — coma es decimal, punto es miles
        cleaned = s.slice(0, lastComma).replace(/\./g, '');
      }
    } else if (lastDot !== -1) {
      // Solo puntos: comprobar si el segmento final tiene 3 dígitos (miles colombiano)
      const afterDot = s.slice(lastDot + 1);
      if (/^\d{3}$/.test(afterDot)) {
        // Separador de miles: 45.000 → 45000
        cleaned = s.replace(/\./g, '');
      } else {
        // Decimal real: 45.5 → 45 (descartamos centavos)
        cleaned = s.slice(0, lastDot);
      }
    } else if (lastComma !== -1) {
      // Solo comas: el segmento final con 3 dígitos = miles
      const afterComma = s.slice(lastComma + 1);
      if (/^\d{3}$/.test(afterComma)) {
        cleaned = s.replace(/,/g, '');
      } else {
        cleaned = s.slice(0, lastComma);
      }
    } else {
      cleaned = s;
    }

    return parseInt(cleaned.replace(/\D/g, ''), 10) || 0;
  }

  /**
   * Busca la cuenta bancaria que coincida con el provider y el externalAccountId.
   * Usado por handleNequi y handleBancolombia (match exacto).
   * handleMobileParser usa sus propias consultas (match por sufijo para Bancolombia).
   */
  private async resolveAccount(
    provider:   string,
    externalId: string,
    fieldName:  string,
  ): Promise<ResolvedAccount> {
    const account = await this.prisma.bankAccount.findFirst({
      where:  { provider, externalAccountId: externalId },
      select: { id: true, userId: true, name: true },
    });

    if (!account) {
      throw new NotFoundException(
        `No se encontró cuenta ${provider} con ${fieldName} = '${externalId}'. ` +
        `Crea una cuenta con provider = '${provider}' y externalAccountId = '${externalId}'.`,
      );
    }
    return account;
  }

  /**
   * Obtiene o crea la categoría para el userId dado.
   * upsert garantiza idempotencia: si ya existe, la reutiliza sin error.
   */
  private async upsertCategory(userId: string, name: string) {
    return this.prisma.category.upsert({
      where:  { name_userId: { name, userId } },
      create: { name, userId },
      update: {},
    });
  }

  /**
   * Actualiza el timestamp de último evento.
   * Llamado por todos los handlers que procesan un webhook exitosamente.
   * El polling del frontend detecta el cambio y hace refetch.
   */
  private emitRefreshEvent(): void {
    this.lastEventAt = new Date();
  }
}
