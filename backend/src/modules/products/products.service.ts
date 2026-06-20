import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BusinessesService } from '../businesses/businesses.service';
import { PlanService } from '../plan/plan.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private businessesService: BusinessesService,
    private planService: PlanService,
  ) {}

  async create(userId: string, businessId: string, dto: CreateProductDto) {
    await this.businessesService.findOne(userId, businessId);
    await this.planService.assertCanCreateProduct(userId, businessId);

    return this.prisma.product.create({
      data: {
        ...dto,
        businessId,
        // Si es servicio, no rastreamos inventario
        trackInventory: dto.type === 'SERVICE' ? false : (dto.trackInventory ?? false),
        stock: dto.type === 'SERVICE' ? 0 : (dto.stock ?? 0),
      },
    });
  }

  async findAll(userId: string, businessId: string, type?: string) {
    await this.businessesService.findOne(userId, businessId);

    const where: any = { businessId, isActive: true };
    if (type) where.type = type;

    return this.prisma.product.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(userId: string, businessId: string, productId: string) {
    await this.businessesService.findOne(userId, businessId);

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) throw new NotFoundException('Producto no encontrado');
    if (product.businessId !== businessId)
      throw new ForbiddenException('No tienes acceso a este producto');

    return product;
  }

  async update(userId: string, businessId: string, productId: string, dto: UpdateProductDto) {
    await this.findOne(userId, businessId, productId);

    return this.prisma.product.update({
      where: { id: productId },
      data: dto,
    });
  }

  // Soft delete — desactiva en vez de borrar para no romper histórico de facturas
  async remove(userId: string, businessId: string, productId: string) {
    await this.findOne(userId, businessId, productId);

    return this.prisma.product.update({
      where: { id: productId },
      data: { isActive: false },
    });
  }

  // Ajuste de stock — se llama al facturar
  async adjustStock(productId: string, quantity: number, operation: 'add' | 'subtract') {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product || !product.trackInventory) return;

    const delta = operation === 'add' ? quantity : -quantity;
    await this.prisma.product.update({
      where: { id: productId },
      data: { stock: { increment: delta } },
    });
  }
}
