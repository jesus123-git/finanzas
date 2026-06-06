import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TransactionType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { FilterTransactionsDto } from './dto/filter-transactions.dto';

// ─── Helpers de balance ───────────────────────────────────────────────────────
// Calculan cuánto se debe sumar/restar al balance de una cuenta dado un tipo.
// Centralizar aquí evita tener lógica de negocio dispersa en múltiples lugares.

function balanceDeltaForAccount(
  type: TransactionType,
  amount: number,
  isOrigin: boolean, // true → cuenta origen, false → cuenta destino
): number {
  switch (type) {
    case TransactionType.INCOME:
      return +amount;                        // suma siempre
    case TransactionType.EXPENSE:
      return -amount;                        // resta siempre
    case TransactionType.TRANSFER:
      return isOrigin ? -amount : +amount;   // resta en origen, suma en destino
  }
}

// ─── Select fijo ─────────────────────────────────────────────────────────────

const TRANSACTION_SELECT = {
  id: true,
  amount: true,
  description: true,
  type: true,
  date: true,
  userId: true,
  createdAt: true,
  bankAccount: { select: { id: true, name: true, currency: true } },
  category: { select: { id: true, name: true } },
} as const;

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Guardia de ownership reutilizable ───────────────────────────────────
  // Verifica que una cuenta bancaria exista y pertenezca al usuario.
  // Usada tanto en CREATE como en validaciones de TRANSFER.

  private async assertAccountOwnership(userId: string, accountId: string, label = 'bankAccountId') {
    const account = await this.prisma.bankAccount.findUnique({
      where: { id: accountId },
      select: { id: true, userId: true, balance: true, name: true },
    });
    if (!account) {
      throw new NotFoundException(`Cuenta '${accountId}' no encontrada`);
    }
    if (account.userId !== userId) {
      throw new ForbiddenException(`No tienes permiso sobre la cuenta en '${label}'`);
    }
    return account;
  }

  // ─── Guardia de ownership para categoría ─────────────────────────────────

  private async assertCategoryOwnership(userId: string, categoryId: string) {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true, userId: true },
    });
    if (!category) {
      throw new NotFoundException(`Categoría '${categoryId}' no encontrada`);
    }
    if (category.userId !== userId) {
      throw new ForbiddenException('No tienes permiso sobre la categoría indicada');
    }
    return category;
  }

  // ─── CREAR ────────────────────────────────────────────────────────────────

  async create(userId: string, dto: CreateTransactionDto) {
    // 1. Validar ownership de cuenta y categoría ANTES de abrir la transacción.
    //    Falla rápido con 403/404 sin tocar la BD si algo es inválido.
    const [originAccount] = await Promise.all([
      this.assertAccountOwnership(userId, dto.bankAccountId, 'bankAccountId'),
      this.assertCategoryOwnership(userId, dto.categoryId),
    ]);

    // 2. Para TRANSFER: validar la cuenta destino
    if (dto.type === TransactionType.TRANSFER) {
      if (!dto.destinationBankAccountId) {
        throw new BadRequestException('destinationBankAccountId es obligatorio para TRANSFER');
      }
      if (dto.destinationBankAccountId === dto.bankAccountId) {
        throw new BadRequestException('La cuenta origen y destino no pueden ser la misma');
      }
      await this.assertAccountOwnership(userId, dto.destinationBankAccountId, 'destinationBankAccountId');
    }

    // 3. Ejecutar TODO dentro de una transacción atómica de Prisma.
    //    Si cualquier operación falla, Prisma hace ROLLBACK automático.
    //    Ni la transacción ni los updates de balance quedan a medias.
    return this.prisma.$transaction(async (tx) => {
      // 3a. Crear el registro de transacción
      const transaction = await tx.transaction.create({
        data: {
          amount: dto.amount,
          description: dto.description,
          type: dto.type,
          date: dto.date ? new Date(dto.date) : new Date(),
          bankAccountId: dto.bankAccountId,
          categoryId: dto.categoryId,
          userId,
        },
        select: TRANSACTION_SELECT,
      });

      // 3b. Actualizar balance de la cuenta ORIGEN
      await tx.bankAccount.update({
        where: { id: dto.bankAccountId },
        data: {
          balance: {
            // Usamos increment/decrement de Prisma en lugar de leer y escribir.
            // Esto evita race conditions si dos requests llegan simultáneamente:
            // la BD aplica la operación atómica directamente (SET balance = balance + X).
            increment: balanceDeltaForAccount(dto.type, dto.amount, true),
          },
        },
      });

      // 3c. Si es TRANSFER, actualizar también la cuenta DESTINO
      if (dto.type === TransactionType.TRANSFER && dto.destinationBankAccountId) {
        await tx.bankAccount.update({
          where: { id: dto.destinationBankAccountId },
          data: {
            balance: {
              increment: balanceDeltaForAccount(dto.type, dto.amount, false),
            },
          },
        });
      }

      return transaction;
    });
  }

  // ─── LISTAR con filtros y paginación ─────────────────────────────────────

  async findAll(userId: string, filters: FilterTransactionsDto) {
    const {
      bankAccountId,
      categoryId,
      type,
      start,
      end,
      page = 1,
      limit = 20,
    } = filters;

    // Construimos el objeto where dinámicamente:
    // solo añadimos cada filtro si el usuario lo envió.
    const where = {
      userId,
      ...(bankAccountId && { bankAccountId }),
      ...(categoryId && { categoryId }),
      ...(type && { type }),
      // Filtro de rango de fechas: ambos extremos son opcionales
      ...((start || end) && {
        date: {
          ...(start && { gte: new Date(start) }),
          ...(end && { lte: new Date(end) }),
        },
      }),
    };

    const skip = (page - 1) * Math.min(limit, 100); // cap en 100 por seguridad
    const take = Math.min(limit, 100);

    // Ejecutamos 3 queries en paralelo con Promise.all:
    // total de registros, página actual y agregados de resumen.
    const [total, data, aggregates] = await Promise.all([
      // Cuenta total para calcular páginas
      this.prisma.transaction.count({ where }),

      // Página de datos con relaciones embebidas
      this.prisma.transaction.findMany({
        where,
        select: TRANSACTION_SELECT,
        orderBy: { date: 'desc' },
        skip,
        take,
      }),

      // Agrupamos INCOME y EXPENSE en una sola query de agregación
      this.prisma.transaction.groupBy({
        by: ['type'],
        where: {
          ...where,
          type: { in: [TransactionType.INCOME, TransactionType.EXPENSE] },
        },
        _sum: { amount: true },
      }),
    ]);

    // Extraemos los totales del resultado de groupBy
    const totalIncome = aggregates.find((a) => a.type === TransactionType.INCOME)?._sum.amount ?? 0;
    const totalExpense = aggregates.find((a) => a.type === TransactionType.EXPENSE)?._sum.amount ?? 0;

    return {
      data,
      total,
      page,
      limit: take,
      totalPages: Math.ceil(total / take),
      totalIncome,
      totalExpense,
    };
  }

  // ─── ELIMINAR (con reversión de balance) ─────────────────────────────────

  async remove(userId: string, transactionId: string) {
    // 1. Buscar la transacción y verificar ownership
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      select: {
        id: true,
        userId: true,
        amount: true,
        type: true,
        bankAccountId: true,
        bankAccount: { select: { name: true } },
      },
    });

    if (!transaction) {
      throw new NotFoundException(`Transacción '${transactionId}' no encontrada`);
    }
    if (transaction.userId !== userId) {
      throw new ForbiddenException('No tienes permiso para eliminar esta transacción');
    }

    // 2. Revertir el impacto en el balance dentro de una transacción atómica.
    //    La reversión es el delta opuesto al original:
    //    - Si era EXPENSE (restó), ahora sumamos → balanceDelta invertido con *-1
    //    - Si era INCOME (sumó), ahora restamos
    //    - Si era TRANSFER, solo revertimos la cuenta origen (la destino no está
    //      registrada en el modelo Transaction — en una v2 sería un campo extra)
    await this.prisma.$transaction([
      this.prisma.bankAccount.update({
        where: { id: transaction.bankAccountId },
        data: {
          balance: {
            // Multiplicamos por -1 para invertir el efecto original
            increment: balanceDeltaForAccount(transaction.type, transaction.amount, true) * -1,
          },
        },
      }),
      this.prisma.transaction.delete({
        where: { id: transactionId },
      }),
    ]);

    return {
      message: `Transacción '${transactionId}' eliminada y balance de '${transaction.bankAccount.name}' revertido`,
    };
  }
}
