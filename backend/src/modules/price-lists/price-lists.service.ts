import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BusinessesService } from '../businesses/businesses.service';
import { PlanService } from '../plan/plan.service';
import { CreatePriceListDto } from './dto/create-price-list.dto';

@Injectable()
export class PriceListsService {
  constructor(
    private prisma: PrismaService,
    private businessesService: BusinessesService,
    private planService: PlanService,
  ) {}

  // ─── Activar/desactivar listas de precios para una empresa ───────────────────

  async togglePriceLists(userId: string, businessId: string, enabled: boolean) {
    await this.businessesService.findOne(userId, businessId);
    if (enabled) await this.planService.assertCanUsePriceLists(userId);
    return this.prisma.business.update({
      where: { id: businessId },
      data: { usePriceLists: enabled },
      select: { id: true, usePriceLists: true },
    });
  }

  // ─── Crear lista de precios ───────────────────────────────────────────────────

  async create(userId: string, businessId: string, dto: CreatePriceListDto) {
    await this.businessesService.findOne(userId, businessId);
    await this.planService.assertCanUsePriceLists(userId);

    // Si es default, quita el default de las demás
    if (dto.isDefault) {
      await this.prisma.priceList.updateMany({
        where: { businessId },
        data: { isDefault: false },
      });
    }

    return this.prisma.priceList.create({
      data: {
        name: dto.name,
        isDefault: dto.isDefault ?? false,
        businessId,
        items: dto.items
          ? {
              create: dto.items.map((item) => ({
                productId: item.productId,
                price: item.price,
              })),
            }
          : undefined,
      },
      include: { items: { include: { product: { select: { id: true, name: true, price: true } } } } },
    });
  }

  // ─── Listar listas de precios ─────────────────────────────────────────────────

  async findAll(userId: string, businessId: string) {
    await this.businessesService.findOne(userId, businessId);

    return this.prisma.priceList.findMany({
      where: { businessId },
      include: {
        items: {
          include: { product: { select: { id: true, name: true, price: true, unit: true } } },
        },
        _count: { select: { customers: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ─── Obtener una lista ────────────────────────────────────────────────────────

  async findOne(userId: string, businessId: string, priceListId: string) {
    await this.businessesService.findOne(userId, businessId);

    const pl = await this.prisma.priceList.findUnique({
      where: { id: priceListId },
      include: {
        items: {
          include: { product: { select: { id: true, name: true, price: true, unit: true, sku: true } } },
        },
      },
    });

    if (!pl) throw new NotFoundException('Lista de precios no encontrada');
    if (pl.businessId !== businessId) throw new ForbiddenException();

    return pl;
  }

  // ─── Actualizar nombre / isDefault ───────────────────────────────────────────

  async update(userId: string, businessId: string, priceListId: string, dto: Partial<CreatePriceListDto>) {
    await this.findOne(userId, businessId, priceListId);

    if (dto.isDefault) {
      await this.prisma.priceList.updateMany({
        where: { businessId },
        data: { isDefault: false },
      });
    }

    return this.prisma.priceList.update({
      where: { id: priceListId },
      data: { name: dto.name, isDefault: dto.isDefault },
      include: { items: { include: { product: { select: { id: true, name: true } } } } },
    });
  }

  // ─── Upsert precios de productos en una lista ─────────────────────────────────

  async upsertItems(
    userId: string,
    businessId: string,
    priceListId: string,
    items: { productId: string; price: number }[],
  ) {
    await this.findOne(userId, businessId, priceListId);

    const ops = items.map((item) =>
      this.prisma.priceListItem.upsert({
        where: { priceListId_productId: { priceListId, productId: item.productId } },
        create: { priceListId, productId: item.productId, price: item.price },
        update: { price: item.price },
      }),
    );

    await this.prisma.$transaction(ops);
    return this.findOne(userId, businessId, priceListId);
  }

  // ─── Eliminar lista de precios ────────────────────────────────────────────────

  async remove(userId: string, businessId: string, priceListId: string) {
    await this.findOne(userId, businessId, priceListId);
    return this.prisma.priceList.delete({ where: { id: priceListId } });
  }

  // ─── Obtener precio de un producto según lista ────────────────────────────────

  async getPriceForProduct(priceListId: string, productId: string): Promise<number | null> {
    const item = await this.prisma.priceListItem.findUnique({
      where: { priceListId_productId: { priceListId, productId } },
    });
    return item ? Number(item.price) : null;
  }
}
