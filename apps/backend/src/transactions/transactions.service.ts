import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { BusinessesService } from '../businesses/businesses.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';

@Injectable()
export class TransactionsService {
  constructor(
    private prisma: PrismaService,
    private businessesService: BusinessesService,
  ) {}

  // ─── Crear transacción empresarial ───────────────────────────────────────────

  async create(userId: string, businessId: string, dto: CreateTransactionDto) {
    await this.businessesService.findOne(userId, businessId);

    return this.prisma.transaction.create({
      data: {
        type: dto.type,
        amount: dto.amount,
        description: dto.description,
        categoryLabel: dto.category,
        notes: dto.notes,
        date: new Date(dto.date),
        businessId,
        owner: 'BUSINESS',
      },
    });
  }

  // ─── Listar transacciones de una empresa ─────────────────────────────────────

  async findAll(userId: string, businessId: string, type?: string) {
    await this.businessesService.findOne(userId, businessId);

    const where: any = { businessId };
    if (type) where.type = type;

    return this.prisma.transaction.findMany({
      where,
      orderBy: { date: 'desc' },
      select: {
        id: true,
        type: true,
        amount: true,
        description: true,
        categoryLabel: true,
        notes: true,
        date: true,
        createdAt: true,
      },
    });
  }

  // ─── Resumen del mes actual ───────────────────────────────────────────────────

  async getSummary(userId: string, businessId: string) {
    await this.businessesService.findOne(userId, businessId);

    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const transactions = await this.prisma.transaction.findMany({
      where: { businessId, date: { gte: start, lte: end } },
      select: { type: true, amount: true },
    });

    const income = transactions
      .filter((t) => t.type === 'INCOME')
      .reduce((s, t) => s + Number(t.amount), 0);
    const expenses = transactions
      .filter((t) => t.type === 'EXPENSE')
      .reduce((s, t) => s + Number(t.amount), 0);

    return { income, expenses, profit: income - expenses };
  }

  // ─── Eliminar transacción ─────────────────────────────────────────────────────

  async remove(userId: string, businessId: string, transactionId: string) {
    await this.businessesService.findOne(userId, businessId);

    const tx = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!tx) throw new NotFoundException('Transacción no encontrada');
    if (tx.businessId !== businessId)
      throw new ForbiddenException('No tienes acceso a esta transacción');

    return this.prisma.transaction.delete({ where: { id: transactionId } });
  }
}
