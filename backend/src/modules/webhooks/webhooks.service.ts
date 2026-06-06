import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TransactionsService } from '../transactions/transactions.service';
import { NequiWebhookPayloadDto } from './dto/nequi-webhook-payload.dto';
import { BancolombiaWebhookPayloadDto } from './dto/bancolombia-webhook-payload.dto';

// ─── Tipos internos ───────────────────────────────────────────────────────────

interface ResolvedAccount {
  id: string;
  userId: string;
  name: string;
}

// ─── Servicio ─────────────────────────────────────────────────────────────────

@Injectable()
export class WebhooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactions: TransactionsService,
  ) {}

  // ── Handler Nequi ───────────────────────────────────────────────────────────

  async handleNequi(payload: NequiWebhookPayloadDto) {
    const account = await this.resolveAccount('NEQUI', payload.phoneNumber, 'phoneNumber');
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

    return { ok: true, provider: 'NEQUI', accountName: account.name, transaction };
  }

  // ── Handler Bancolombia ─────────────────────────────────────────────────────

  async handleBancolombia(payload: BancolombiaWebhookPayloadDto) {
    const account = await this.resolveAccount(
      'BANCOLOMBIA',
      payload.accountNumber,
      'accountNumber',
    );
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

    return { ok: true, provider: 'BANCOLOMBIA', accountName: account.name, transaction };
  }

  // ── Helpers privados ────────────────────────────────────────────────────────

  /**
   * Busca la cuenta bancaria que coincida con el provider y el externalAccountId.
   * El campo externalAccountId almacena tanto números de celular (Nequi) como
   * números de cuenta bancaria (Bancolombia) — el BankAccount.provider distingue cuál es cuál.
   */
  private async resolveAccount(
    provider: string,
    externalId: string,
    fieldName: string,
  ): Promise<ResolvedAccount> {
    const account = await this.prisma.bankAccount.findFirst({
      where: { provider, externalAccountId: externalId },
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
   * Obtiene o crea la categoría de la entidad para el usuario.
   * upsert garantiza idempotencia: si ya existe, la reutiliza.
   */
  private async upsertCategory(userId: string, name: string) {
    return this.prisma.category.upsert({
      where:  { name_userId: { name, userId } },
      create: { name, userId },
      update: {},
    });
  }
}
