// backend/src/modules/plan/plan.service.ts
import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

const LIMITS = {
  FREE:    { invoices: 15,   customers: 15,   products: 10,   quotes: 5,    suppliers: 5,    businesses: 1,    members: 0    },
  PRO:     { invoices: null, customers: null, products: null, quotes: null, suppliers: null, businesses: 1,    members: 1    },
  EMPRESA: { invoices: null, customers: null, products: null, quotes: null, suppliers: null, businesses: null, members: null },
} as const;

export interface UsageStats {
  plan: 'FREE' | 'PRO' | 'EMPRESA';
  planExpiresAt: string | null;
  invoicesThisMonth: number; invoiceLimit: number | null;
  customersCount: number;    customerLimit: number | null;
  productsCount: number;     productLimit: number | null;
  quotesThisMonth: number;   quoteLimit: number | null;
  suppliersCount: number;    supplierLimit: number | null;
  membersCount: number;      memberLimit: number | null;
  canUsePriceLists: boolean;
  canAddBusiness: boolean;
}

@Injectable()
export class PlanService {
  constructor(private prisma: PrismaService) {}

  private startOfMonth(): Date {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private async getUserPlan(userId: string): Promise<{ plan: import('@prisma/client').PlanType; isStaff: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, isStaff: true },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return { plan: user.plan, isStaff: user.isStaff };
  }

  async assertBusinessAccess(userId: string, businessId: string): Promise<void> {
    const { isStaff } = await this.getUserPlan(userId);
    if (isStaff) return;

    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { userId: true },
    });
    if (!business) throw new NotFoundException('Empresa no encontrada');
    if (business.userId === userId) return;

    const member = await this.prisma.businessMember.findUnique({
      where: { businessId_userId: { businessId, userId } },
    });
    if (!member) throw new ForbiddenException('NOT_A_MEMBER');
  }

  async assertWriteAccess(userId: string, businessId: string): Promise<void> {
    const { isStaff } = await this.getUserPlan(userId);
    if (isStaff) return;

    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { userId: true },
    });
    if (!business) throw new NotFoundException('Empresa no encontrada');
    if (business.userId === userId) return;

    const member = await this.prisma.businessMember.findUnique({
      where: { businessId_userId: { businessId, userId } },
    });
    if (!member) throw new ForbiddenException('NOT_A_MEMBER');
    if (member.role === 'VIEWER') throw new ForbiddenException('VIEWER_CANNOT_WRITE');
  }

  async assertCanCreateInvoice(userId: string, businessId: string): Promise<void> {
    const { plan, isStaff } = await this.getUserPlan(userId);
    if (isStaff) return;
    const limit = LIMITS[plan].invoices;
    if (limit === null) return;
    const count = await this.prisma.invoice.count({
      where: { businessId, createdAt: { gte: this.startOfMonth() } },
    });
    if (count >= limit) throw new ForbiddenException('INVOICE_LIMIT_REACHED');
  }

  async assertCanCreateCustomer(userId: string, businessId: string): Promise<void> {
    const { plan, isStaff } = await this.getUserPlan(userId);
    if (isStaff) return;
    const limit = LIMITS[plan].customers;
    if (limit === null) return;
    const count = await this.prisma.customer.count({ where: { businessId } });
    if (count >= limit) throw new ForbiddenException('CLIENT_LIMIT_REACHED');
  }

  async assertCanCreateProduct(userId: string, businessId: string): Promise<void> {
    const { plan, isStaff } = await this.getUserPlan(userId);
    if (isStaff) return;
    const limit = LIMITS[plan].products;
    if (limit === null) return;
    const count = await this.prisma.product.count({ where: { businessId, isActive: true } });
    if (count >= limit) throw new ForbiddenException('PRODUCT_LIMIT_REACHED');
  }

  async assertCanCreateQuotation(userId: string, businessId: string): Promise<void> {
    const { plan, isStaff } = await this.getUserPlan(userId);
    if (isStaff) return;
    const limit = LIMITS[plan].quotes;
    if (limit === null) return;
    const count = await this.prisma.quote.count({
      where: { businessId, createdAt: { gte: this.startOfMonth() } },
    });
    if (count >= limit) throw new ForbiddenException('QUOTE_LIMIT_REACHED');
  }

  async assertCanCreateSupplier(userId: string, businessId: string): Promise<void> {
    const { plan, isStaff } = await this.getUserPlan(userId);
    if (isStaff) return;
    const limit = LIMITS[plan].suppliers;
    if (limit === null) return;
    const count = await this.prisma.supplier.count({ where: { businessId, isActive: true } });
    if (count >= limit) throw new ForbiddenException('SUPPLIER_LIMIT_REACHED');
  }

  async assertCanCreateBusiness(userId: string): Promise<void> {
    const { plan, isStaff } = await this.getUserPlan(userId);
    if (isStaff) return;
    const limit = LIMITS[plan].businesses;
    if (limit === null) return;
    const count = await this.prisma.business.count({ where: { userId, isActive: true } });
    if (count >= limit) throw new ForbiddenException('BUSINESS_LIMIT_REACHED');
  }

  async assertCanUsePriceLists(userId: string): Promise<void> {
    const { plan, isStaff } = await this.getUserPlan(userId);
    if (isStaff) return;
    if (plan === 'FREE') throw new ForbiddenException('FEATURE_NOT_AVAILABLE');
  }

  async assertCanAddMember(userId: string, businessId: string): Promise<void> {
    const { plan, isStaff } = await this.getUserPlan(userId);
    if (isStaff) return;
    const limit = LIMITS[plan].members;
    if (limit === null) return;
    if (limit === 0) throw new ForbiddenException('MEMBER_LIMIT_REACHED');
    const count = await this.prisma.businessMember.count({ where: { businessId } });
    if (count >= limit) throw new ForbiddenException('MEMBER_LIMIT_REACHED');
  }

  async getUsage(userId: string, businessId: string): Promise<UsageStats> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, planExpiresAt: true },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    const plan = user.plan;
    const limits = LIMITS[plan];
    const som = this.startOfMonth();

    const [invoicesThisMonth, customersCount, productsCount, quotesThisMonth, suppliersCount, membersCount, businessCount] =
      await Promise.all([
        this.prisma.invoice.count({ where: { businessId, createdAt: { gte: som } } }),
        this.prisma.customer.count({ where: { businessId } }),
        this.prisma.product.count({ where: { businessId, isActive: true } }),
        this.prisma.quote.count({ where: { businessId, createdAt: { gte: som } } }),
        this.prisma.supplier.count({ where: { businessId, isActive: true } }),
        this.prisma.businessMember.count({ where: { businessId } }),
        this.prisma.business.count({ where: { userId, isActive: true } }),
      ]);

    return {
      plan,
      planExpiresAt: user.planExpiresAt?.toISOString() ?? null,
      invoicesThisMonth, invoiceLimit: limits.invoices,
      customersCount,    customerLimit: limits.customers,
      productsCount,     productLimit: limits.products,
      quotesThisMonth,   quoteLimit: limits.quotes,
      suppliersCount,    supplierLimit: limits.suppliers,
      membersCount,      memberLimit: limits.members,
      canUsePriceLists: plan !== 'FREE',
      canAddBusiness: limits.businesses === null ? true : businessCount < limits.businesses,
    };
  }
}
