import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PlanService } from '../plan/plan.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { BulkImportBizDto } from './dto/bulk-import-biz.dto';

@Injectable()
export class BusinessesService {
  constructor(
    private prisma: PrismaService,
    private planService: PlanService,
  ) {}

  // ─── Crear empresa ────────────────────────────────────────────────────────────

  async create(userId: string, dto: CreateBusinessDto) {
    await this.planService.assertCanCreateBusiness(userId);
    return this.prisma.business.create({
      data: {
        ...dto,
        userId,
      },
      // Incluir _count igual que findAll: el frontend renderiza las tarjetas
      // con biz._count.* y sin esto la empresa recién creada rompe la lista
      include: {
        _count: {
          select: {
            customers: true,
            invoices: true,
            bizTransactions: true,
          },
        },
      },
    });
  }

  // ─── Listar empresas del usuario ──────────────────────────────────────────────

  async findAll(userId: string) {
    return this.prisma.business.findMany({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            customers: true,
            invoices: true,
            bizTransactions: true,
          },
        },
      },
    });
  }

  // ─── Obtener una empresa por ID ───────────────────────────────────────────────

  async findOne(userId: string, businessId: string) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      include: {
        _count: {
          select: { customers: true, invoices: true, bizTransactions: true },
        },
      },
    });

    if (!business) throw new NotFoundException('Empresa no encontrada');
    if (business.userId !== userId) throw new ForbiddenException('No tienes acceso a esta empresa');

    return business;
  }

  // ─── Actualizar empresa ───────────────────────────────────────────────────────

  async update(userId: string, businessId: string, dto: UpdateBusinessDto) {
    await this.findOne(userId, businessId); // verifica que existe y es del usuario

    return this.prisma.business.update({
      where: { id: businessId },
      data: dto,
    });
  }

  // ─── Archivar empresa (soft delete) ──────────────────────────────────────────

  async remove(userId: string, businessId: string) {
    await this.findOne(userId, businessId); // verifica que existe y es del usuario

    return this.prisma.business.update({
      where: { id: businessId },
      data: { isActive: false },
    });
  }

  // ─── Importación masiva desde plantilla Excel empresa ────────────────────────

  async bulkImportBizTransactions(userId: string, businessId: string, dto: BulkImportBizDto) {
    // Verificar que el usuario es dueño de la empresa
    await this.findOne(userId, businessId);

    const data = dto.rows.map(row => ({
      businessId,
      type:          row.type,
      amount:        row.amount,
      description:   row.description,
      // Almacenar desglose en categoryLabel: "subtotal|iva|clienteProveedor|nroFactura"
      categoryLabel: [
        row.clienteProveedor ?? '',
        row.nroFactura       ?? '',
        row.subtotal != null ? `subtotal:${row.subtotal}` : '',
        row.iva      != null ? `iva:${row.iva}`           : '',
      ].filter(Boolean).join(' | ') || null,
      date: new Date(row.date),
    }));

    const result = await this.prisma.bizTransaction.createMany({ data, skipDuplicates: false });

    return {
      inserted:    result.count,
      accountName: 'empresa', // no hay cuenta bancaria en módulo empresarial
    };
  }

  // ─── Dashboard KPIs de la empresa ────────────────────────────────────────────

  async getDashboard(userId: string, businessId: string) {
    await this.findOne(userId, businessId);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Ingresos del mes
    const incomeResult = await this.prisma.bizTransaction.aggregate({
      where: {
        businessId,
        type: 'INCOME',
        date: { gte: startOfMonth },
      },
      _sum: { amount: true },
    });

    // Gastos del mes
    const expenseResult = await this.prisma.bizTransaction.aggregate({
      where: {
        businessId,
        type: 'EXPENSE',
        date: { gte: startOfMonth },
      },
      _sum: { amount: true },
    });

    // Facturas pendientes de cobro
    const pendingInvoices = await this.prisma.invoice.aggregate({
      where: {
        businessId,
        status: { in: ['SENT', 'VIEWED', 'OVERDUE'] },
      },
      _sum: { total: true },
      _count: true,
    });

    const income = Number(incomeResult._sum.amount ?? 0);
    const expenses = Number(expenseResult._sum.amount ?? 0);

    return {
      currentMonth: {
        income,
        expenses,
        profit: income - expenses,
      },
      pendingCollection: {
        total: Number(pendingInvoices._sum.total ?? 0),
        count: pendingInvoices._count,
      },
    };
  }
}
