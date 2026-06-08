import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TransactionType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { balanceDeltaForAccount } from '../../common/utils/balance.utils';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { FilterTransactionsDto } from './dto/filter-transactions.dto';
import { BulkImportDto } from './dto/bulk-import.dto';

// ─── Parámetros para creación interna (webhooks, seeds, etc.) ────────────────

export interface CreateTransactionInternalParams {
  bankAccountId: string;
  categoryId: string;
  userId: string;
  amount: number;
  // Prisma genera TransactionType como objeto const, no enum nativo de TS.
  // Usamos Extract para restringir a solo INCOME/EXPENSE sin crear un type nuevo.
  type: Extract<TransactionType, 'INCOME' | 'EXPENSE'>;
  description: string;
  date: Date;
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
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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
    type AggRow = (typeof aggregates)[number];
    const totalIncome = aggregates.find((a: AggRow) => a.type === TransactionType.INCOME)?._sum.amount ?? 0;
    const totalExpense = aggregates.find((a: AggRow) => a.type === TransactionType.EXPENSE)?._sum.amount ?? 0;

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

  // ─── IMPORTACIÓN MASIVA desde Excel ─────────────────────────────────────

  async bulkImport(userId: string, dto: BulkImportDto) {
    // 1. Validar ownership de cuenta y categoría antes de escribir
    const [account] = await Promise.all([
      this.assertAccountOwnership(userId, dto.bankAccountId),
      this.assertCategoryOwnership(userId, dto.categoryId),
    ]);

    // 2. Preparar registros
    const data = dto.rows.map((row) => ({
      amount:        row.amount,
      description:   row.description,
      type:          row.type,
      date:          new Date(row.date),
      bankAccountId: dto.bankAccountId,
      categoryId:    dto.categoryId,
      userId,
    }));

    // 3. Insertar todo en una transacción atómica y actualizar balance
    const inserted = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const { count } = await tx.transaction.createMany({ data });

      // Calcular el delta neto de balance para la cuenta
      const delta = data.reduce(
        (sum, row) => sum + balanceDeltaForAccount(row.type, row.amount, true),
        0,
      );

      if (delta !== 0) {
        await tx.bankAccount.update({
          where: { id: dto.bankAccountId },
          data:  { balance: { increment: delta } },
        });
      }

      return count;
    });

    return { inserted, accountName: account.name };
  }

  // ─── RESUMEN POR CATEGORÍA (para la gráfica de dona) ────────────────────

  async getCategoryStats(userId: string, year: number, month: number) {
    // Rango Colombia: primer y último día del mes a medianoche Bogotá (UTC-5)
    const start = new Date(Date.UTC(year, month - 1, 1,  5, 0, 0, 0));
    const end   = new Date(Date.UTC(year, month,     0, 28, 59, 59, 999)); // último día del mes 23:59:59 Bogotá

    // Agrupar gastos por categoría
    const grouped = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        userId,
        type: TransactionType.EXPENSE,
        date: { gte: start, lte: end },
      },
      _sum:   { amount: true },
      _count: true,
      orderBy: { _sum: { amount: 'desc' } },
    });

    if (grouped.length === 0) {
      return { year, month, items: [], total: 0 };
    }

    // Obtener nombres de categorías en un solo query
    const categoryIds = grouped.map((g) => g.categoryId);
    const categories  = await this.prisma.category.findMany({
      where:  { id: { in: categoryIds } },
      select: { id: true, name: true },
    });
    const catMap = new Map(categories.map((c) => [c.id, c.name]));

    const total = grouped.reduce((sum, g) => sum + Number(g._sum.amount ?? 0), 0);

    const items = grouped.map((g) => ({
      categoryId:   g.categoryId,
      categoryName: catMap.get(g.categoryId) ?? 'Sin categoría',
      total:        Number(g._sum.amount ?? 0),
      count:        g._count,
      percentage:   total > 0 ? (Number(g._sum.amount ?? 0) / total) * 100 : 0,
    }));

    return { year, month, items, total };
  }

  // ─── CALENDARIO: totales diarios de ingresos y gastos ───────────────────

  async getCalendar(userId: string, year: number, month: number) {
    // Ampliamos el rango UTC ±1 día para cubrir el desfase Colombia (UTC-5).
    // Luego filtramos por día real en hora Colombia al agrupar.
    const start = new Date(Date.UTC(year, month - 1, 0, 12, 0, 0));   // Último día del mes previo 12:00 UTC
    const end   = new Date(Date.UTC(year, month,     2, 12, 0, 0));   // 2do día del mes siguiente 12:00 UTC

    const txs = await this.prisma.transaction.findMany({
      where: {
        userId,
        type: { in: [TransactionType.INCOME, TransactionType.EXPENSE] },
        date: { gte: start, lte: end },
      },
      select: { date: true, amount: true, type: true },
      orderBy: { date: 'asc' },
    });

    // Formateador de fecha en zona horaria de Bogotá (UTC-5, sin DST)
    const bogota = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Bogota',
      year:  'numeric',
      month: 'numeric',
      day:   'numeric',
    });

    const days: Record<string, { income: number; expense: number; count: number }> = {};

    for (const tx of txs) {
      const parts  = bogota.formatToParts(tx.date);
      const txYear  = parseInt(parts.find(p => p.type === 'year')!.value,  10);
      const txMonth = parseInt(parts.find(p => p.type === 'month')!.value, 10);
      const txDay   = parseInt(parts.find(p => p.type === 'day')!.value,   10);

      // Solo incluir transacciones del mes y año solicitados
      if (txYear !== year || txMonth !== month) continue;

      const key = txDay.toString();
      if (!days[key]) days[key] = { income: 0, expense: 0, count: 0 };
      days[key].count++;
      if (tx.type === TransactionType.INCOME) {
        days[key].income += Number(tx.amount);
      } else {
        days[key].expense += Number(tx.amount);
      }
    }

    return { year, month, days };
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

  // ─── CREAR INTERNA (uso por webhooks / scripts) ───────────────────────────
  // No hace validaciones de ownership — el caller ya verificó que los IDs
  // pertenecen al usuario correcto antes de llamar este método.

  async createForWebhook(params: CreateTransactionInternalParams) {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const transaction = await tx.transaction.create({
        data: {
          amount:        params.amount,
          description:   params.description,
          type:          params.type,
          date:          params.date,
          bankAccountId: params.bankAccountId,
          categoryId:    params.categoryId,
          userId:        params.userId,
        },
        select: TRANSACTION_SELECT,
      });

      await tx.bankAccount.update({
        where: { id: params.bankAccountId },
        data:  { balance: { increment: balanceDeltaForAccount(params.type, params.amount, true) } },
      });

      return transaction;
    });
  }
}
