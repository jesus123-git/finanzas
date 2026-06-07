import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { BusinessesService } from '../businesses/businesses.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(
    private prisma: PrismaService,
    private businessesService: BusinessesService,
  ) {}

  // ─── Crear cliente ────────────────────────────────────────────────────────────

  async create(userId: string, businessId: string, dto: CreateCustomerDto) {
    // Verifica que la empresa existe y pertenece al usuario
    await this.businessesService.findOne(userId, businessId);

    return this.prisma.customer.create({
      data: { ...dto, businessId },
    });
  }

  // ─── Listar clientes de una empresa ──────────────────────────────────────────

  async findAll(userId: string, businessId: string) {
    await this.businessesService.findOne(userId, businessId);

    return this.prisma.customer.findMany({
      where: { businessId },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { invoices: true } },
      },
    });
  }

  // ─── Obtener un cliente por ID ────────────────────────────────────────────────

  async findOne(userId: string, businessId: string, customerId: string) {
    await this.businessesService.findOne(userId, businessId);

    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        invoices: {
          orderBy: { createdAt: 'desc' },
          take: 5, // últimas 5 facturas
          select: {
            id: true,
            number: true,
            total: true,
            status: true,
            issueDate: true,
          },
        },
      },
    });

    if (!customer) throw new NotFoundException('Cliente no encontrado');
    if (customer.businessId !== businessId) throw new ForbiddenException('No tienes acceso a este cliente');

    return customer;
  }

  // ─── Actualizar cliente ───────────────────────────────────────────────────────

  async update(userId: string, businessId: string, customerId: string, dto: UpdateCustomerDto) {
    await this.findOne(userId, businessId, customerId);

    return this.prisma.customer.update({
      where: { id: customerId },
      data: dto,
    });
  }

  // ─── Eliminar cliente ─────────────────────────────────────────────────────────

  async remove(userId: string, businessId: string, customerId: string) {
    await this.findOne(userId, businessId, customerId);

    return this.prisma.customer.delete({
      where: { id: customerId },
    });
  }

  // ─── Estado de cuenta del cliente ────────────────────────────────────────────

  async getStatement(userId: string, businessId: string, customerId: string) {
    await this.findOne(userId, businessId, customerId);

    // Total facturado
    const totalInvoiced = await this.prisma.invoice.aggregate({
      where: { customerId, businessId },
      _sum: { total: true },
    });

    // Total pendiente de cobro
    const totalPending = await this.prisma.invoice.aggregate({
      where: {
        customerId,
        businessId,
        status: { in: ['SENT', 'VIEWED', 'OVERDUE'] },
      },
      _sum: { total: true },
      _count: true,
    });

    // Total cobrado
    const totalPaid = await this.prisma.invoice.aggregate({
      where: { customerId, businessId, status: 'PAID' },
      _sum: { total: true },
    });

    // Facturas vencidas
    const overdueInvoices = await this.prisma.invoice.findMany({
      where: { customerId, businessId, status: 'OVERDUE' },
      select: { id: true, number: true, total: true, dueDate: true },
    });

    return {
      totalInvoiced: Number(totalInvoiced._sum.total ?? 0),
      totalPaid: Number(totalPaid._sum.total ?? 0),
      totalPending: Number(totalPending._sum.total ?? 0),
      pendingInvoicesCount: totalPending._count,
      overdueInvoices,
    };
  }
}
