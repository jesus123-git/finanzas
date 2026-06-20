import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BusinessesService } from '../businesses/businesses.service';
import { PlanService } from '../plan/plan.service';
import { CreateQuoteDto } from './dto/create-quote.dto';

@Injectable()
export class QuotesService {
  constructor(
    private prisma: PrismaService,
    private businessesService: BusinessesService,
    private planService: PlanService,
  ) {}

  // ─── Generar número de cotización (CT-0001) ───────────────────────────────────

  private async generateNumber(businessId: string): Promise<string> {
    const count = await this.prisma.quote.count({ where: { businessId } });
    return `CT-${String(count + 1).padStart(4, '0')}`;
  }

  // ─── Crear cotización ─────────────────────────────────────────────────────────

  async create(userId: string, businessId: string, dto: CreateQuoteDto) {
    await this.businessesService.findOne(userId, businessId);
    await this.planService.assertCanCreateQuotation(userId, businessId);

    const subtotal = dto.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    const tax = dto.items.reduce((s, i) => s + i.quantity * i.unitPrice * i.taxRate / 100, 0);
    const total = subtotal + tax;
    const number = await this.generateNumber(businessId);

    return this.prisma.quote.create({
      data: {
        businessId,
        customerId: dto.customerId,
        number,
        notes: dto.notes,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
        subtotal,
        tax,
        total,
        items: {
          create: dto.items.map((i) => ({
            productId: i.productId,
            description: i.description,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            taxRate: i.taxRate,
            total: i.quantity * i.unitPrice * (1 + i.taxRate / 100),
          })),
        },
      },
      include: {
        customer: { select: { id: true, name: true } },
        items: true,
      },
    });
  }

  // ─── Listar cotizaciones ──────────────────────────────────────────────────────

  async findAll(userId: string, businessId: string, status?: string) {
    await this.businessesService.findOne(userId, businessId);

    const where: any = { businessId };
    if (status) where.status = status;

    return this.prisma.quote.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { id: true, name: true } },
        _count: { select: { items: true } },
      },
    });
  }

  // ─── Obtener una cotización ───────────────────────────────────────────────────

  async findOne(userId: string, businessId: string, quoteId: string) {
    await this.businessesService.findOne(userId, businessId);

    const quote = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      include: {
        customer: { select: { id: true, name: true, nit: true, email: true } },
        items: { include: { product: { select: { id: true, name: true } } } },
        invoice: { select: { id: true, number: true } },
      },
    });

    if (!quote) throw new NotFoundException('Cotización no encontrada');
    if (quote.businessId !== businessId) throw new ForbiddenException();

    return quote;
  }

  // ─── Cambiar estado ───────────────────────────────────────────────────────────

  async updateStatus(userId: string, businessId: string, quoteId: string, status: string) {
    const quote = await this.findOne(userId, businessId, quoteId);

    if (quote.status === 'INVOICED')
      throw new BadRequestException('Esta cotización ya fue convertida en factura');

    return this.prisma.quote.update({
      where: { id: quoteId },
      data: { status: status as any },
    });
  }

  // ─── Convertir cotización en factura ─────────────────────────────────────────

  async convertToInvoice(userId: string, businessId: string, quoteId: string) {
    const quote = await this.findOne(userId, businessId, quoteId);

    if (quote.status === 'INVOICED')
      throw new BadRequestException('Esta cotización ya fue convertida en factura');

    // Generar número de factura
    const invoiceCount = await this.prisma.invoice.count({ where: { businessId } });
    const invoiceNumber = `FV-${String(invoiceCount + 1).padStart(4, '0')}`;

    // Crear factura con los mismos ítems
    const invoice = await this.prisma.invoice.create({
      data: {
        businessId,
        customerId: quote.customerId,
        number: invoiceNumber,
        subtotal: quote.subtotal,
        tax: quote.tax,
        total: quote.total,
        notes: quote.notes,
        items: {
          create: quote.items.map((item) => ({
            productId: item.productId,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            taxRate: item.taxRate,
            total: item.total,
          })),
        },
      },
      include: { items: true, customer: { select: { id: true, name: true } } },
    });

    // Marcar cotización como facturada y enlazarla
    await this.prisma.quote.update({
      where: { id: quoteId },
      data: { status: 'INVOICED', invoiceId: invoice.id },
    });

    return invoice;
  }

  // ─── Eliminar cotización ──────────────────────────────────────────────────────

  async remove(userId: string, businessId: string, quoteId: string) {
    const quote = await this.findOne(userId, businessId, quoteId);

    if (quote.status === 'INVOICED')
      throw new BadRequestException('No se puede eliminar una cotización ya facturada');

    return this.prisma.quote.delete({ where: { id: quoteId } });
  }
}
