import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BusinessesService } from '../businesses/businesses.service';
import { PlanService } from '../plan/plan.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(
    private prisma: PrismaService,
    private businessesService: BusinessesService,
    private planService: PlanService,
  ) {}

  async create(userId: string, businessId: string, dto: CreateSupplierDto) {
    await this.businessesService.findOne(userId, businessId);
    await this.planService.assertCanCreateSupplier(userId, businessId);
    return this.prisma.supplier.create({
      data: { businessId, ...dto },
    });
  }

  async findAll(userId: string, businessId: string) {
    await this.businessesService.findOne(userId, businessId);
    return this.prisma.supplier.findMany({
      where: { businessId, isActive: true },
      orderBy: { name: 'asc' },
      include: { _count: { select: { purchases: true } } },
    });
  }

  async findOne(userId: string, businessId: string, supplierId: string) {
    await this.businessesService.findOne(userId, businessId);
    const supplier = await this.prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) throw new NotFoundException('Proveedor no encontrado');
    if (supplier.businessId !== businessId) throw new ForbiddenException();
    return supplier;
  }

  async update(userId: string, businessId: string, supplierId: string, dto: Partial<CreateSupplierDto>) {
    await this.findOne(userId, businessId, supplierId);
    return this.prisma.supplier.update({ where: { id: supplierId }, data: dto });
  }

  async remove(userId: string, businessId: string, supplierId: string) {
    await this.findOne(userId, businessId, supplierId);
    return this.prisma.supplier.update({ where: { id: supplierId }, data: { isActive: false } });
  }
}
