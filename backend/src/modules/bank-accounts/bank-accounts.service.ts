import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import { UpdateBankAccountDto } from './dto/update-bank-account.dto';

// Campos que devolvemos en cada respuesta — nunca exponemos campos internos
// que no sirvan al cliente (p.ej. claves de auditoría internas).
const ACCOUNT_SELECT = {
  id: true,
  name: true,
  type: true,
  balance: true,
  currency: true,
  provider: true,
  externalAccountId: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class BankAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Crear ────────────────────────────────────────────────────────────────

  async create(userId: string, dto: CreateBankAccountDto) {
    return this.prisma.bankAccount.create({
      data: {
        ...dto,
        // Siempre asignamos el userId desde el token JWT,
        // nunca desde el body — el cliente no puede suplantar otro usuario.
        userId,
      },
      select: ACCOUNT_SELECT,
    });
  }

  // ─── Leer todas (del usuario autenticado) ─────────────────────────────────

  async findAll(userId: string) {
    return this.prisma.bankAccount.findMany({
      where: { userId },
      select: ACCOUNT_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Leer una ─────────────────────────────────────────────────────────────

  async findOne(userId: string, accountId: string) {
    const account = await this.prisma.bankAccount.findUnique({
      where: { id: accountId },
      select: ACCOUNT_SELECT,
    });

    // 404 si no existe, 403 si existe pero pertenece a otro usuario.
    // Separamos los casos para dar mensajes claros en desarrollo,
    // aunque en producción podrías unificarlos en un solo 404 para no filtrar info.
    if (!account) {
      throw new NotFoundException(`Cuenta con id '${accountId}' no encontrada`);
    }
    if (account.userId !== userId) {
      throw new ForbiddenException('No tienes permiso para acceder a esta cuenta');
    }

    return account;
  }

  // ─── Actualizar ───────────────────────────────────────────────────────────

  async update(userId: string, accountId: string, dto: UpdateBankAccountDto) {
    // Verificamos ownership antes de actualizar (reutilizamos findOne)
    await this.findOne(userId, accountId);

    return this.prisma.bankAccount.update({
      where: { id: accountId },
      data: dto,
      select: ACCOUNT_SELECT,
    });
  }

  // ─── Eliminar ─────────────────────────────────────────────────────────────

  async remove(userId: string, accountId: string) {
    // Verificamos ownership antes de eliminar
    await this.findOne(userId, accountId);

    await this.prisma.bankAccount.delete({ where: { id: accountId } });

    // Devolvemos un mensaje explícito en lugar de 204 vacío
    // para que el cliente tenga confirmación legible.
    return { message: `Cuenta '${accountId}' eliminada correctamente` };
  }

  // ─── Resumen de saldo total ───────────────────────────────────────────────
  // Endpoint de utilidad: suma el balance de todas las cuentas del usuario.

  async getBalanceSummary(userId: string) {
    const accounts = await this.prisma.bankAccount.findMany({
      where: { userId },
      select: { balance: true, currency: true, type: true },
    });

    // Agrupamos por moneda para soportar multi-currency en el futuro
    const summary = accounts.reduce<Record<string, number>>((acc, account) => {
      acc[account.currency] = (acc[account.currency] ?? 0) + account.balance;
      return acc;
    }, {});

    return {
      totalByCurrency: summary,
      accountCount: accounts.length,
    };
  }
}
