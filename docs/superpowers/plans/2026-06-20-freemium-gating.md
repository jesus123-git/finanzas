# Freemium Gating + Equipos — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar sistema de planes FREE/PRO/EMPRESA con límites por recurso, modal de upgrade automático, barras de uso y módulo de equipo multi-usuario por empresa.

**Architecture:** PlanService centralizado en el backend verifica límites antes de cada operación de escritura. El frontend obtiene el estado de uso vía /usage y muestra un UpgradeModal global disparado por un interceptor Axios cuando el backend retorna códigos de error de límite.

**Tech Stack:** NestJS + Prisma + PostgreSQL (backend) · Next.js 14 App Router + TanStack Query + Tailwind (frontend)

---

## FASE 1 — Límites de plan (Tasks 1–13)

---

### Task 1: Migración Prisma — schema completo de planes y equipo

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Añadir enums y campos al schema**

En `backend/prisma/schema.prisma`, añadir los enums nuevos ANTES de los enums existentes:

```prisma
enum PlanType {
  FREE
  PRO
  EMPRESA
}

enum MemberRole {
  EDITOR
  VIEWER
}
```

En el modelo `User`, añadir los tres campos nuevos después de `updatedAt`:

```prisma
  plan          PlanType  @default(FREE)
  planExpiresAt DateTime?
  planStartedAt DateTime?

  businessMembers BusinessMember[]
```

Añadir los dos modelos nuevos al final del archivo, antes del último comentario si lo hay:

```prisma
model BusinessMember {
  id         String     @id @default(uuid())
  businessId String
  userId     String
  role       MemberRole
  title      String?
  invitedAt  DateTime   @default(now())

  business   Business   @relation(fields: [businessId], references: [id], onDelete: Cascade)
  user       User       @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([businessId, userId])
  @@map("business_members")
}

model BusinessInvite {
  id         String     @id @default(uuid())
  businessId String
  email      String
  role       MemberRole
  title      String?
  token      String     @unique
  expiresAt  DateTime
  usedAt     DateTime?

  business   Business   @relation(fields: [businessId], references: [id], onDelete: Cascade)

  @@map("business_invites")
}
```

En el modelo `Business`, añadir las relaciones nuevas después de `bizTransactions`:

```prisma
  members    BusinessMember[]
  invites    BusinessInvite[]
```

- [ ] **Ejecutar migración**

```bash
cd /Users/sebastiansalgado/Documents/finanzas/backend
npx prisma migrate dev --name add-plan-and-team
```

Salida esperada: `Your database is now in sync with your schema.`

- [ ] **Verificar que Prisma Client se regeneró**

```bash
npx prisma generate
```

- [ ] **Commit**

```bash
cd /Users/sebastiansalgado/Documents/finanzas
git add backend/prisma/
git commit -m "feat: add PlanType, BusinessMember and BusinessInvite to schema"
```

---

### Task 2: Añadir plan al JWT y al tipo User del frontend

**Files:**
- Modify: `backend/src/modules/auth/strategies/jwt.strategy.ts`
- Modify: `backend/src/modules/auth/auth.service.ts`
- Modify: `backend/src/modules/auth/auth.controller.ts`
- Modify: `frontend/src/types/auth.types.ts`

- [ ] **Actualizar JwtStrategy.validate para seleccionar plan**

En `backend/src/modules/auth/strategies/jwt.strategy.ts`, cambiar el select:

```typescript
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, plan: true },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    return user;
```

- [ ] **Actualizar buildTokenResponse en AuthService**

En `backend/src/modules/auth/auth.service.ts`, actualizar el método `buildTokenResponse` y los selects en `register` y `login`:

En `register()`, cambiar el select de `user.create`:
```typescript
      select: { id: true, email: true, name: true, plan: true },
```

En `login()`, cambiar la línea de `buildTokenResponse`:
```typescript
    return this.buildTokenResponse({
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
    });
```

Cambiar la firma y cuerpo de `buildTokenResponse`:
```typescript
  private buildTokenResponse(user: { id: string; email: string; name: string | null; plan: import('@prisma/client').PlanType }) {
    const payload: JwtPayload = { sub: user.id, email: user.email };

    return {
      accessToken: this.jwtService.sign(payload),
      user: { id: user.id, email: user.email, name: user.name, plan: user.plan },
    };
  }
```

- [ ] **Actualizar getProfile en AuthController**

En `backend/src/modules/auth/auth.controller.ts`, línea del decorador:
```typescript
  getProfile(@CurrentUser() user: { id: string; email: string; name: string | null; plan: string }) {
    return user;
  }
```

- [ ] **Añadir plan al tipo User del frontend**

En `frontend/src/types/auth.types.ts`:
```typescript
export interface User {
  id: string;
  email: string;
  name: string | null;
  plan: 'FREE' | 'PRO' | 'EMPRESA';
}
```

- [ ] **Verificar compilación**

```bash
cd /Users/sebastiansalgado/Documents/finanzas/backend && node_modules/.bin/tsc --noEmit
cd /Users/sebastiansalgado/Documents/finanzas/frontend && node_modules/.bin/tsc --noEmit
```

Salida esperada: sin errores.

- [ ] **Commit**

```bash
git add backend/src/modules/auth/ frontend/src/types/auth.types.ts
git commit -m "feat: include plan in JWT response and User type"
```

---

### Task 3: Crear PlanService

**Files:**
- Create: `backend/src/modules/plan/plan.service.ts`
- Create: `backend/src/modules/plan/plan.module.ts`

- [ ] **Crear plan.service.ts**

```typescript
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

  private async getUserPlan(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user.plan;
  }

  async assertBusinessAccess(userId: string, businessId: string): Promise<void> {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { userId: true },
    });
    if (!business) throw new NotFoundException('Empresa no encontrada');
    if (business.userId !== userId) throw new ForbiddenException('NOT_A_MEMBER');
  }

  async assertCanCreateInvoice(userId: string, businessId: string): Promise<void> {
    const plan = await this.getUserPlan(userId);
    const limit = LIMITS[plan].invoices;
    if (limit === null) return;
    const count = await this.prisma.invoice.count({
      where: { businessId, createdAt: { gte: this.startOfMonth() } },
    });
    if (count >= limit) throw new ForbiddenException('INVOICE_LIMIT_REACHED');
  }

  async assertCanCreateCustomer(userId: string, businessId: string): Promise<void> {
    const plan = await this.getUserPlan(userId);
    const limit = LIMITS[plan].customers;
    if (limit === null) return;
    const count = await this.prisma.customer.count({ where: { businessId } });
    if (count >= limit) throw new ForbiddenException('CLIENT_LIMIT_REACHED');
  }

  async assertCanCreateProduct(userId: string, businessId: string): Promise<void> {
    const plan = await this.getUserPlan(userId);
    const limit = LIMITS[plan].products;
    if (limit === null) return;
    const count = await this.prisma.product.count({ where: { businessId, isActive: true } });
    if (count >= limit) throw new ForbiddenException('PRODUCT_LIMIT_REACHED');
  }

  async assertCanCreateQuotation(userId: string, businessId: string): Promise<void> {
    const plan = await this.getUserPlan(userId);
    const limit = LIMITS[plan].quotes;
    if (limit === null) return;
    const count = await this.prisma.quote.count({
      where: { businessId, createdAt: { gte: this.startOfMonth() } },
    });
    if (count >= limit) throw new ForbiddenException('QUOTE_LIMIT_REACHED');
  }

  async assertCanCreateSupplier(userId: string, businessId: string): Promise<void> {
    const plan = await this.getUserPlan(userId);
    const limit = LIMITS[plan].suppliers;
    if (limit === null) return;
    const count = await this.prisma.supplier.count({ where: { businessId, isActive: true } });
    if (count >= limit) throw new ForbiddenException('SUPPLIER_LIMIT_REACHED');
  }

  async assertCanCreateBusiness(userId: string): Promise<void> {
    const plan = await this.getUserPlan(userId);
    const limit = LIMITS[plan].businesses;
    if (limit === null) return;
    const count = await this.prisma.business.count({ where: { userId, isActive: true } });
    if (count >= limit) throw new ForbiddenException('BUSINESS_LIMIT_REACHED');
  }

  async assertCanUsePriceLists(userId: string): Promise<void> {
    const plan = await this.getUserPlan(userId);
    if (plan === 'FREE') throw new ForbiddenException('FEATURE_NOT_AVAILABLE');
  }

  async assertCanAddMember(userId: string, businessId: string): Promise<void> {
    const plan = await this.getUserPlan(userId);
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
```

- [ ] **Crear plan.module.ts**

```typescript
// backend/src/modules/plan/plan.module.ts
import { Module } from '@nestjs/common';
import { PlanService } from './plan.service';

@Module({
  providers: [PlanService],
  exports: [PlanService],
})
export class PlanModule {}
```

- [ ] **Registrar PlanModule en AppModule**

En `backend/src/app.module.ts`, añadir el import:
```typescript
import { PlanModule } from './modules/plan/plan.module';
```

Y en el array `imports`, después de `BusinessesModule`:
```typescript
    PlanModule,
```

- [ ] **Verificar compilación**

```bash
cd /Users/sebastiansalgado/Documents/finanzas/backend && node_modules/.bin/tsc --noEmit
```

- [ ] **Commit**

```bash
git add backend/src/modules/plan/ backend/src/app.module.ts
git commit -m "feat: add PlanService and PlanModule with all limit assertions"
```

---

### Task 4: Añadir límites en InvoicesService y CustomersService

**Files:**
- Modify: `backend/src/modules/invoices/invoices.module.ts`
- Modify: `backend/src/modules/invoices/invoices.service.ts`
- Modify: `backend/src/modules/customers/customers.module.ts`
- Modify: `backend/src/modules/customers/customers.service.ts`

- [ ] **Actualizar InvoicesModule**

```typescript
// backend/src/modules/invoices/invoices.module.ts
import { Module } from '@nestjs/common';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { BusinessesModule } from '../businesses/businesses.module';
import { ProductsModule } from '../products/products.module';
import { PlanModule } from '../plan/plan.module';

@Module({
  imports: [BusinessesModule, ProductsModule, PlanModule],
  controllers: [InvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
```

- [ ] **Actualizar InvoicesService**

En `backend/src/modules/invoices/invoices.service.ts`, añadir el import y la inyección:

```typescript
import { PlanService } from '../plan/plan.service';
```

En el constructor:
```typescript
  constructor(
    private prisma: PrismaService,
    private businessesService: BusinessesService,
    private productsService: ProductsService,
    private planService: PlanService,
  ) {}
```

En el método `create()`, añadir la segunda línea justo después de la primera:
```typescript
  async create(userId: string, businessId: string, dto: CreateInvoiceDto) {
    await this.businessesService.findOne(userId, businessId);
    await this.planService.assertCanCreateInvoice(userId, businessId);
    // ...resto sin cambios
```

- [ ] **Actualizar CustomersModule**

```typescript
// backend/src/modules/customers/customers.module.ts
import { Module } from '@nestjs/common';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { BusinessesModule } from '../businesses/businesses.module';
import { PlanModule } from '../plan/plan.module';

@Module({
  imports: [BusinessesModule, PlanModule],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
```

- [ ] **Actualizar CustomersService**

En `backend/src/modules/customers/customers.service.ts`:

```typescript
import { PlanService } from '../plan/plan.service';
```

En el constructor:
```typescript
  constructor(
    private prisma: PrismaService,
    private businessesService: BusinessesService,
    private planService: PlanService,
  ) {}
```

En `create()`:
```typescript
  async create(userId: string, businessId: string, dto: CreateCustomerDto) {
    await this.businessesService.findOne(userId, businessId);
    await this.planService.assertCanCreateCustomer(userId, businessId);
    return this.prisma.customer.create({ data: { ...dto, businessId } });
  }
```

- [ ] **Verificar compilación**

```bash
cd /Users/sebastiansalgado/Documents/finanzas/backend && node_modules/.bin/tsc --noEmit
```

- [ ] **Commit**

```bash
git add backend/src/modules/invoices/ backend/src/modules/customers/
git commit -m "feat: enforce invoice and customer plan limits"
```

---

### Task 5: Límites en Products, Quotes, Suppliers, Businesses y PriceLists

**Files:**
- Modify: `backend/src/modules/products/products.module.ts`
- Modify: `backend/src/modules/products/products.service.ts`
- Modify: `backend/src/modules/quotes/quotes.module.ts`
- Modify: `backend/src/modules/quotes/quotes.service.ts`
- Modify: `backend/src/modules/suppliers/suppliers.module.ts`
- Modify: `backend/src/modules/suppliers/suppliers.service.ts`
- Modify: `backend/src/modules/businesses/businesses.module.ts`
- Modify: `backend/src/modules/businesses/businesses.service.ts`
- Modify: `backend/src/modules/price-lists/price-lists.module.ts`
- Modify: `backend/src/modules/price-lists/price-lists.service.ts`

- [ ] **ProductsModule**

```typescript
import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { BusinessesModule } from '../businesses/businesses.module';
import { PlanModule } from '../plan/plan.module';

@Module({
  imports: [BusinessesModule, PlanModule],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
```

- [ ] **ProductsService — añadir PlanService y llamada en create()**

Añadir import: `import { PlanService } from '../plan/plan.service';`

En constructor añadir `private planService: PlanService`.

En `create()`, añadir después de `businessesService.findOne`:
```typescript
    await this.planService.assertCanCreateProduct(userId, businessId);
```

- [ ] **QuotesModule**

```typescript
import { Module } from '@nestjs/common';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';
import { BusinessesModule } from '../businesses/businesses.module';
import { PlanModule } from '../plan/plan.module';

@Module({
  imports: [BusinessesModule, PlanModule],
  controllers: [QuotesController],
  providers: [QuotesService],
  exports: [QuotesService],
})
export class QuotesModule {}
```

- [ ] **QuotesService — añadir PlanService y llamada en create()**

Añadir import: `import { PlanService } from '../plan/plan.service';`

En constructor añadir `private planService: PlanService`.

En `create()`:
```typescript
    await this.businessesService.findOne(userId, businessId);
    await this.planService.assertCanCreateQuotation(userId, businessId);
```

- [ ] **SuppliersModule**

```typescript
import { Module } from '@nestjs/common';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';
import { BusinessesModule } from '../businesses/businesses.module';
import { PlanModule } from '../plan/plan.module';

@Module({
  imports: [BusinessesModule, PlanModule],
  controllers: [SuppliersController],
  providers: [SuppliersService],
  exports: [SuppliersService],
})
export class SuppliersModule {}
```

- [ ] **SuppliersService — añadir PlanService y llamada en create()**

Añadir import: `import { PlanService } from '../plan/plan.service';`

En constructor añadir `private planService: PlanService`.

En `create()`:
```typescript
    await this.businessesService.findOne(userId, businessId);
    await this.planService.assertCanCreateSupplier(userId, businessId);
```

- [ ] **BusinessesModule**

```typescript
import { Module } from '@nestjs/common';
import { BusinessesController } from './businesses.controller';
import { BusinessesService } from './businesses.service';
import { PlanModule } from '../plan/plan.module';

@Module({
  imports: [PlanModule],
  controllers: [BusinessesController],
  providers: [BusinessesService],
  exports: [BusinessesService],
})
export class BusinessesModule {}
```

- [ ] **BusinessesService — añadir PlanService y llamada en create()**

Añadir import: `import { PlanService } from '../plan/plan.service';`

En constructor añadir `private planService: PlanService`.

En `create()`, añadir como primera línea:
```typescript
    await this.planService.assertCanCreateBusiness(userId);
```

- [ ] **PriceListsModule**

```typescript
import { Module } from '@nestjs/common';
import { PriceListsController } from './price-lists.controller';
import { PriceListsService } from './price-lists.service';
import { BusinessesModule } from '../businesses/businesses.module';
import { PlanModule } from '../plan/plan.module';

@Module({
  imports: [BusinessesModule, PlanModule],
  controllers: [PriceListsController],
  providers: [PriceListsService],
  exports: [PriceListsService],
})
export class PriceListsModule {}
```

- [ ] **PriceListsService — proteger create() y togglePriceLists()**

Añadir import: `import { PlanService } from '../plan/plan.service';`

En constructor añadir `private planService: PlanService`.

En `create()`:
```typescript
    await this.businessesService.findOne(userId, businessId);
    await this.planService.assertCanUsePriceLists(userId);
```

En `togglePriceLists()`, añadir después del findOne:
```typescript
    if (enabled) await this.planService.assertCanUsePriceLists(userId);
```

- [ ] **Verificar compilación backend completo**

```bash
cd /Users/sebastiansalgado/Documents/finanzas/backend && node_modules/.bin/tsc --noEmit
```

Salida esperada: sin errores.

- [ ] **Commit**

```bash
git add backend/src/modules/products/ backend/src/modules/quotes/ backend/src/modules/suppliers/ backend/src/modules/businesses/ backend/src/modules/price-lists/
git commit -m "feat: enforce plan limits across all business creation endpoints"
```

---

### Task 6: Endpoint GET /businesses/:id/usage

**Files:**
- Modify: `backend/src/modules/businesses/businesses.controller.ts`

- [ ] **Añadir el endpoint al controller**

En `backend/src/modules/businesses/businesses.controller.ts`, añadir `PlanService` al constructor y el endpoint:

Añadir import:
```typescript
import { PlanService } from '../plan/plan.service';
```

Añadir al constructor:
```typescript
  constructor(
    private businessesService: BusinessesService,
    private planService: PlanService,
  ) {}
```

Añadir el endpoint (después del GET `/:id` existente):
```typescript
  // GET /api/v1/businesses/:id/usage
  @Get(':id/usage')
  @ApiOperation({ summary: 'Estado de uso del plan para esta empresa' })
  getUsage(
    @CurrentUser() user: { id: string },
    @Param('id') businessId: string,
  ) {
    return this.planService.getUsage(user.id, businessId);
  }
```

- [ ] **Verificar compilación**

```bash
cd /Users/sebastiansalgado/Documents/finanzas/backend && node_modules/.bin/tsc --noEmit
```

- [ ] **Probar el endpoint en el navegador o con curl**

Con el servidor corriendo (`npm run start:dev`):
```bash
curl -H "Authorization: Bearer <tu_token>" http://localhost:3001/api/v1/businesses/<businessId>/usage
```

Respuesta esperada:
```json
{
  "plan": "FREE",
  "planExpiresAt": null,
  "invoicesThisMonth": 0,
  "invoiceLimit": 15,
  "customersCount": 0,
  "customerLimit": 15,
  "productsCount": 0,
  "productLimit": 10,
  "quotesThisMonth": 0,
  "quoteLimit": 5,
  "suppliersCount": 0,
  "supplierLimit": 5,
  "membersCount": 0,
  "memberLimit": 0,
  "canUsePriceLists": false,
  "canAddBusiness": false
}
```

- [ ] **Commit**

```bash
git add backend/src/modules/businesses/businesses.controller.ts
git commit -m "feat: add GET /businesses/:id/usage endpoint"
```

---

### Task 7: Frontend — upgradeModalBus + interceptor Axios

**Files:**
- Create: `frontend/src/lib/upgradeModalBus.ts`
- Modify: `frontend/src/lib/axios.ts`

- [ ] **Crear upgradeModalBus.ts**

```typescript
// frontend/src/lib/upgradeModalBus.ts
type Listener = (errorCode: string) => void;

const listeners: Listener[] = [];

export const upgradeModalBus = {
  emit(code: string) {
    listeners.forEach(fn => fn(code));
  },
  on(fn: Listener) {
    listeners.push(fn);
    return () => {
      const i = listeners.indexOf(fn);
      if (i !== -1) listeners.splice(i, 1);
    };
  },
};
```

- [ ] **Añadir detección de errores de límite al interceptor en axios.ts**

En `frontend/src/lib/axios.ts`, añadir el import al inicio:
```typescript
import { upgradeModalBus } from './upgradeModalBus';
```

Añadir la constante y la lógica DENTRO del interceptor de error existente, antes del `return Promise.reject(error)`:

```typescript
const UPGRADE_ERRORS = new Set([
  'INVOICE_LIMIT_REACHED', 'CLIENT_LIMIT_REACHED', 'PRODUCT_LIMIT_REACHED',
  'QUOTE_LIMIT_REACHED',   'SUPPLIER_LIMIT_REACHED', 'BUSINESS_LIMIT_REACHED',
  'MEMBER_LIMIT_REACHED',  'FEATURE_NOT_AVAILABLE',
]);

// ─── Response interceptor: manejar 401 y errores de límite de plan ───────────
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      removeToken();
      removeSessionCookie();
      window.location.href = '/login';
    }
    const code: string = error.response?.data?.message ?? '';
    if (UPGRADE_ERRORS.has(code)) {
      upgradeModalBus.emit(code);
    }
    return Promise.reject(error);
  },
);
```

- [ ] **Verificar compilación frontend**

```bash
cd /Users/sebastiansalgado/Documents/finanzas/frontend && node_modules/.bin/tsc --noEmit
```

- [ ] **Commit**

```bash
git add frontend/src/lib/upgradeModalBus.ts frontend/src/lib/axios.ts
git commit -m "feat: add upgradeModalBus and plan limit interceptor to axios"
```

---

### Task 8: Frontend — PlanContext

**Files:**
- Create: `frontend/src/context/PlanContext.tsx`

- [ ] **Crear PlanContext.tsx**

```tsx
// frontend/src/context/PlanContext.tsx
'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/axios';

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

interface PlanContextValue {
  plan: 'FREE' | 'PRO' | 'EMPRESA';
  usage: UsageStats | null;
  isLoading: boolean;
  refetch: () => void;
}

const PlanContext = createContext<PlanContextValue | null>(null);

export function PlanProvider({ children, businessId }: { children: ReactNode; businessId: string }) {
  const { data, isLoading, refetch } = useQuery<UsageStats>({
    queryKey: ['usage', businessId],
    queryFn: async () => (await api.get(`/businesses/${businessId}/usage`)).data,
    enabled: !!businessId,
    staleTime: 30_000,
  });

  return (
    <PlanContext.Provider value={{ plan: data?.plan ?? 'FREE', usage: data ?? null, isLoading, refetch }}>
      {children}
    </PlanContext.Provider>
  );
}

export function usePlan(): PlanContextValue {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error('usePlan must be used inside PlanProvider');
  return ctx;
}
```

- [ ] **Commit**

```bash
git add frontend/src/context/PlanContext.tsx
git commit -m "feat: add PlanContext with usage stats from /businesses/:id/usage"
```

---

### Task 9: Frontend — layout.tsx para /empresas/[id]/

**Files:**
- Create: `frontend/src/app/(dashboard)/empresas/[id]/layout.tsx`

- [ ] **Crear layout.tsx**

```tsx
// frontend/src/app/(dashboard)/empresas/[id]/layout.tsx
import { type ReactNode } from 'react';
import { PlanProvider } from '@/context/PlanContext';
import { UpgradeModalProvider } from '@/context/UpgradeModalContext';

export default function BusinessLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { id: string };
}) {
  return (
    <PlanProvider businessId={params.id}>
      <UpgradeModalProvider>
        {children}
      </UpgradeModalProvider>
    </PlanProvider>
  );
}
```

Nota: `UpgradeModalContext` se crea en el siguiente task. Por ahora el archivo puede quedar comentado hasta que exista.

- [ ] **Commit**

```bash
git add frontend/src/app/(dashboard)/empresas/[id]/layout.tsx
git commit -m "feat: add PlanProvider layout for /empresas/[id]"
```

---

### Task 10: Frontend — UpgradeModal + UpgradeModalContext

**Files:**
- Create: `frontend/src/context/UpgradeModalContext.tsx`
- Create: `frontend/src/components/ui/UpgradeModal.tsx`

- [ ] **Crear UpgradeModal.tsx**

```tsx
// frontend/src/components/ui/UpgradeModal.tsx
'use client';

import { useRouter } from 'next/navigation';
import { X, Zap } from 'lucide-react';

const MESSAGES: Record<string, { title: string; body: string }> = {
  INVOICE_LIMIT_REACHED:  { title: 'Límite de facturas alcanzado',     body: 'Has usado todas tus facturas del mes en el plan gratuito. Con Nomi PRO creas facturas ilimitadas.' },
  CLIENT_LIMIT_REACHED:   { title: 'Límite de clientes alcanzado',     body: 'Alcanzaste el límite de 15 clientes. Con Nomi PRO puedes añadir clientes ilimitados.' },
  PRODUCT_LIMIT_REACHED:  { title: 'Límite de productos alcanzado',    body: 'Tu catálogo tiene 10 productos activos. Con Nomi PRO tienes productos ilimitados.' },
  QUOTE_LIMIT_REACHED:    { title: 'Límite de cotizaciones alcanzado', body: 'Usaste tus 5 cotizaciones del mes. Con Nomi PRO creas cotizaciones ilimitadas.' },
  SUPPLIER_LIMIT_REACHED: { title: 'Límite de proveedores alcanzado',  body: 'Alcanzaste el límite de 5 proveedores. Con Nomi PRO tienes proveedores ilimitados.' },
  BUSINESS_LIMIT_REACHED: { title: 'Límite de empresas alcanzado',     body: 'Tu plan solo permite 1 empresa activa. Con Nomi Empresa puedes gestionar negocios ilimitados.' },
  MEMBER_LIMIT_REACHED:   { title: 'Límite de equipo alcanzado',       body: 'Tu plan no permite más colaboradores. Actualiza para ampliar tu equipo.' },
  FEATURE_NOT_AVAILABLE:  { title: 'Función exclusiva PRO',            body: 'Las listas de precios diferenciadas están disponibles desde Nomi PRO.' },
};

interface Props {
  open: boolean;
  errorCode: string;
  onClose: () => void;
}

export function UpgradeModal({ open, errorCode, onClose }: Props) {
  const router = useRouter();
  if (!open) return null;
  const msg = MESSAGES[errorCode] ?? { title: 'Actualiza tu plan', body: 'Esta función requiere un plan superior.' };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm p-6 shadow-xl border border-gray-100 dark:border-gray-800">
        <div className="flex items-start justify-between mb-4">
          <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
            <Zap size={20} className="text-blue-600 dark:text-blue-400" />
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition">
            <X size={20} />
          </button>
        </div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{msg.title}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{msg.body}</p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 py-2.5 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition text-sm"
          >
            Más tarde
          </button>
          <button
            onClick={() => { onClose(); router.push('/planes'); }}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-medium transition text-sm"
          >
            Ver planes
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Crear UpgradeModalContext.tsx**

```tsx
// frontend/src/context/UpgradeModalContext.tsx
'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { upgradeModalBus } from '@/lib/upgradeModalBus';
import { UpgradeModal } from '@/components/ui/UpgradeModal';

interface UpgradeModalContextValue {
  showUpgrade: (code: string) => void;
}

const UpgradeModalContext = createContext<UpgradeModalContextValue | null>(null);

export function UpgradeModalProvider({ children }: { children: ReactNode }) {
  const [errorCode, setErrorCode] = useState<string | null>(null);

  useEffect(() => {
    return upgradeModalBus.on(code => setErrorCode(code));
  }, []);

  return (
    <UpgradeModalContext.Provider value={{ showUpgrade: setErrorCode }}>
      {children}
      <UpgradeModal
        open={errorCode !== null}
        errorCode={errorCode ?? ''}
        onClose={() => setErrorCode(null)}
      />
    </UpgradeModalContext.Provider>
  );
}

export function useUpgradeModal() {
  const ctx = useContext(UpgradeModalContext);
  if (!ctx) throw new Error('useUpgradeModal must be used inside UpgradeModalProvider');
  return ctx;
}
```

- [ ] **Actualizar layout.tsx para descomentar UpgradeModalProvider**

El layout ya lo importa — verificar que el archivo compila:

```bash
cd /Users/sebastiansalgado/Documents/finanzas/frontend && node_modules/.bin/tsc --noEmit
```

- [ ] **Commit**

```bash
git add frontend/src/context/UpgradeModalContext.tsx frontend/src/components/ui/UpgradeModal.tsx
git commit -m "feat: add UpgradeModal and UpgradeModalContext driven by upgradeModalBus"
```

---

### Task 11: Frontend — UsageCard en el dashboard de empresa

**Files:**
- Create: `frontend/src/components/ui/UsageCard.tsx`
- Modify: `frontend/src/app/(dashboard)/empresas/[id]/page.tsx`

- [ ] **Crear UsageCard.tsx**

```tsx
// frontend/src/components/ui/UsageCard.tsx
'use client';

import { useRouter } from 'next/navigation';
import { usePlan } from '@/context/PlanContext';

function Bar({ value, limit }: { value: number; limit: number | null }) {
  if (limit === null) return <span className="text-xs text-green-600 dark:text-green-400 font-medium">Ilimitado</span>;
  const pct = Math.min((value / limit) * 100, 100);
  const color = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-400' : 'bg-blue-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 dark:text-gray-400 w-10 text-right">{value}/{limit}</span>
    </div>
  );
}

const ROWS = [
  { label: 'Facturas este mes', valueKey: 'invoicesThisMonth' as const, limitKey: 'invoiceLimit' as const },
  { label: 'Clientes',          valueKey: 'customersCount'    as const, limitKey: 'customerLimit' as const },
  { label: 'Productos',         valueKey: 'productsCount'     as const, limitKey: 'productLimit'  as const },
  { label: 'Cotizaciones',      valueKey: 'quotesThisMonth'   as const, limitKey: 'quoteLimit'    as const },
  { label: 'Proveedores',       valueKey: 'suppliersCount'    as const, limitKey: 'supplierLimit' as const },
];

export function UsageCard() {
  const { plan, usage, isLoading } = usePlan();
  const router = useRouter();

  if (isLoading || !usage) return null;

  if (plan !== 'FREE') {
    return (
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40 rounded-xl px-4 py-3 flex items-center justify-between">
        <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Plan {plan} activo</span>
        <span className="text-xs text-blue-500 dark:text-blue-400">✓ Sin límites</span>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Plan gratuito</span>
      </div>
      <div className="space-y-2">
        {ROWS.map(row => (
          <div key={row.valueKey} className="flex items-center gap-3">
            <span className="text-xs text-gray-600 dark:text-gray-400 w-36 flex-shrink-0">{row.label}</span>
            <Bar value={usage[row.valueKey]} limit={usage[row.limitKey]} />
          </div>
        ))}
      </div>
      <button
        onClick={() => router.push('/planes')}
        className="w-full mt-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-xs font-semibold transition"
      >
        Actualizar a Nomi PRO — $16.900/mes
      </button>
    </div>
  );
}
```

- [ ] **Integrar UsageCard en la página del dashboard**

En `frontend/src/app/(dashboard)/empresas/[id]/page.tsx`, añadir el import:
```typescript
import { UsageCard } from '@/components/ui/UsageCard';
```

Dentro de `<main>`, añadir el componente justo antes del cierre de `</main>`, después del grid de módulos:
```tsx
        {/* Estado del plan */}
        <UsageCard />
```

- [ ] **Verificar compilación**

```bash
cd /Users/sebastiansalgado/Documents/finanzas/frontend && node_modules/.bin/tsc --noEmit
```

- [ ] **Commit**

```bash
git add frontend/src/components/ui/UsageCard.tsx frontend/src/app/(dashboard)/empresas/[id]/page.tsx
git commit -m "feat: add UsageCard with plan usage bars to business dashboard"
```

---

### Task 12: Frontend — PlanGate en listas de precios

**Files:**
- Create: `frontend/src/components/ui/PlanGate.tsx`
- Modify: `frontend/src/app/(dashboard)/empresas/[id]/listas-precios/page.tsx`

- [ ] **Crear PlanGate.tsx**

```tsx
// frontend/src/components/ui/PlanGate.tsx
'use client';

import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';
import { usePlan } from '@/context/PlanContext';

const PLAN_ORDER = { FREE: 0, PRO: 1, EMPRESA: 2 } as const;

interface Props {
  requiredPlan: 'PRO' | 'EMPRESA';
  featureName: string;
  featureDescription: string;
  children: React.ReactNode;
}

export function PlanGate({ requiredPlan, featureName, featureDescription, children }: Props) {
  const { plan } = usePlan();
  const router = useRouter();

  if (PLAN_ORDER[plan] >= PLAN_ORDER[requiredPlan]) return <>{children}</>;

  return (
    <div className="min-h-[300px] flex items-center justify-center">
      <div className="text-center max-w-sm mx-auto px-6">
        <div className="w-14 h-14 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Lock size={24} className="text-blue-600 dark:text-blue-400" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{featureName}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{featureDescription}</p>
        <button
          onClick={() => router.push('/planes')}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium transition text-sm"
        >
          Ver planes
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Integrar PlanGate en listas-precios/page.tsx**

En `frontend/src/app/(dashboard)/empresas/[id]/listas-precios/page.tsx`, añadir el import:
```typescript
import { PlanGate } from '@/components/ui/PlanGate';
```

Envolver el contenido del `<main>` con PlanGate. Justo después de `<main className="max-w-4xl mx-auto px-6 py-8 space-y-6">`, añadir:
```tsx
      <PlanGate
        requiredPlan="PRO"
        featureName="Listas de precios — Nomi PRO"
        featureDescription="Crea precios diferenciados por tipo de cliente: mayorista, minorista, VIP. Disponible en Nomi PRO y Nomi Empresa."
      >
```

Y cerrar `</PlanGate>` justo antes de `</main>`.

- [ ] **Verificar compilación**

```bash
cd /Users/sebastiansalgado/Documents/finanzas/frontend && node_modules/.bin/tsc --noEmit
```

- [ ] **Commit**

```bash
git add frontend/src/components/ui/PlanGate.tsx frontend/src/app/(dashboard)/empresas/[id]/listas-precios/page.tsx
git commit -m "feat: add PlanGate component and gate price-lists to PRO plan"
```

---

### Task 13: Frontend — página /planes

**Files:**
- Create: `frontend/src/app/(dashboard)/planes/page.tsx`

- [ ] **Crear planes/page.tsx**

```tsx
// frontend/src/app/(dashboard)/planes/page.tsx
'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Check, X, ArrowLeft } from 'lucide-react';
import { usePlan } from '@/context/PlanContext';
import { useAuth } from '@/context/auth.context';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

const PLANS = [
  {
    key: 'FREE' as const,
    name: 'Gratuito',
    price: '$0',
    period: 'siempre',
    description: 'Para empezar a ordenar tus finanzas',
    color: 'border-gray-200 dark:border-gray-700',
    badge: null,
    features: [
      '1 empresa activa',
      '15 facturas por mes',
      '15 clientes',
      '10 productos en catálogo',
      '5 cotizaciones por mes',
      '5 proveedores',
      'Seguimiento de inventario',
      'Finanzas personales completas',
    ],
    blocked: ['Listas de precios diferenciadas', 'Usuarios adicionales'],
    cta: null,
  },
  {
    key: 'PRO' as const,
    name: 'Nomi PRO',
    price: '$16.900',
    period: 'mes',
    description: 'Para negocios que están creciendo',
    color: 'border-blue-500',
    badge: 'Más popular',
    features: [
      'Todo en Gratuito',
      'Facturas, clientes y productos ilimitados',
      'Cotizaciones y proveedores ilimitados',
      'Listas de precios diferenciadas',
      '1 usuario adicional (Editor o Viewer)',
      'Soporte prioritario',
    ],
    blocked: ['Más de 1 empresa', 'Más de 1 usuario adicional'],
    cta: 'PRO' as const,
  },
  {
    key: 'EMPRESA' as const,
    name: 'Nomi Empresa',
    price: '$34.900',
    period: 'mes',
    description: 'Para grupos y múltiples negocios',
    color: 'border-gray-200 dark:border-gray-700',
    badge: null,
    features: [
      'Todo en Nomi PRO',
      'Empresas ilimitadas',
      'Usuarios ilimitados por empresa',
      'Soporte prioritario',
    ],
    blocked: [],
    cta: 'EMPRESA' as const,
  },
];

export default function PlanesPage() {
  const { plan } = usePlan();
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const status = searchParams.get('status');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <nav className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/personal" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition">
              <ArrowLeft size={20} />
            </Link>
            <span className="font-semibold text-gray-900 dark:text-white">Planes</span>
          </div>
          <ThemeToggle />
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-10">

        {status === 'success' && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 text-center text-green-700 dark:text-green-300 font-medium">
            ¡Plan activado correctamente! Ya tienes acceso a todas las funciones.
          </div>
        )}
        {status === 'error' && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-center text-red-700 dark:text-red-300 font-medium">
            Hubo un problema con el pago. Por favor inténtalo de nuevo.
          </div>
        )}

        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Elige tu plan</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">Sin contratos. Cancela cuando quieras.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map(p => {
            const isCurrent = plan === p.key;
            return (
              <div
                key={p.key}
                className={`bg-white dark:bg-gray-900 rounded-2xl border-2 p-6 flex flex-col ${p.color} ${p.key === 'PRO' ? 'ring-2 ring-blue-500/20' : ''}`}
              >
                {p.badge && (
                  <span className="inline-block self-start mb-3 text-xs font-semibold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full">
                    {p.badge}
                  </span>
                )}
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{p.name}</h2>
                <div className="mt-2 mb-1">
                  <span className="text-3xl font-bold text-gray-900 dark:text-white">{p.price}</span>
                  {p.period !== 'siempre' && <span className="text-gray-500 dark:text-gray-400 text-sm ml-1">/ {p.period}</span>}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">{p.description}</p>

                <ul className="space-y-2 flex-1 mb-6">
                  {p.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <Check size={15} className="text-green-500 flex-shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                  {p.blocked.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-400 dark:text-gray-600">
                      <X size={15} className="flex-shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <div className="w-full py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 text-center text-sm text-gray-500 dark:text-gray-400 font-medium">
                    Plan actual
                  </div>
                ) : p.cta ? (
                  <Link
                    href={`/checkout?plan=${p.cta}`}
                    className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-center text-sm font-semibold transition block"
                  >
                    Activar {p.name}
                  </Link>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="text-center text-xs text-gray-400 dark:text-gray-600">
          Precios en COP · IVA no incluido · Renovación mensual automática
        </div>
      </main>
    </div>
  );
}
```

Nota: Esta página usa `usePlan()` que requiere estar dentro de `PlanProvider`. Como `/planes` está fuera de `/empresas/[id]/`, necesita su propio provider o se puede omitir el plan actual. Para simplificar, el componente puede manejar el caso donde `usePlan` no esté disponible. Crear un wrapper:

Reemplazar el uso directo de `usePlan()` con una versión safe que use el plan del auth context:

```tsx
// Cambiar la línea:
const { plan } = usePlan();
// Por:
const { user } = useAuth();
const plan = (user as any)?.plan ?? 'FREE';
```

Y eliminar el import de `usePlan`.

- [ ] **Crear página de checkout (stub)**

```tsx
// frontend/src/app/(dashboard)/checkout/page.tsx
'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api } from '@/lib/axios';

export default function CheckoutPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const plan = searchParams.get('plan');

  useEffect(() => {
    if (!plan) { router.replace('/planes'); return; }

    api.post('/subscriptions/checkout', { plan })
      .then(({ data }) => {
        if (data.status === 'GATEWAY_PENDING') {
          router.replace('/planes');
          return;
        }
        window.location.href = data.url;
      })
      .catch(() => router.replace('/planes?status=error'));
  }, [plan, router]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-gray-500 dark:text-gray-400 text-sm">Preparando tu pago...</p>
      </div>
    </div>
  );
}
```

- [ ] **Verificar compilación**

```bash
cd /Users/sebastiansalgado/Documents/finanzas/frontend && node_modules/.bin/tsc --noEmit
```

- [ ] **Commit**

```bash
git add frontend/src/app/(dashboard)/planes/ frontend/src/app/(dashboard)/checkout/
git commit -m "feat: add /planes pricing page and /checkout stub"
```

---

## FASE 2 — Equipo multi-usuario (Tasks 14–18)

---

### Task 14: BusinessMembersService + Module

**Files:**
- Create: `backend/src/modules/business-members/business-members.service.ts`
- Create: `backend/src/modules/business-members/business-members.module.ts`
- Create: `backend/src/modules/business-members/dto/invite-member.dto.ts`
- Create: `backend/src/modules/business-members/dto/update-member.dto.ts`

- [ ] **Instalar Resend para emails de invitación**

```bash
cd /Users/sebastiansalgado/Documents/finanzas/backend
npm install resend
```

- [ ] **Crear invite-member.dto.ts**

```typescript
// backend/src/modules/business-members/dto/invite-member.dto.ts
import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { MemberRole } from '@prisma/client';

export class InviteMemberDto {
  @IsEmail()
  email: string;

  @IsEnum(MemberRole)
  role: MemberRole;

  @IsOptional()
  @IsString()
  title?: string;
}
```

- [ ] **Crear update-member.dto.ts**

```typescript
// backend/src/modules/business-members/dto/update-member.dto.ts
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { MemberRole } from '@prisma/client';

export class UpdateMemberDto {
  @IsOptional()
  @IsEnum(MemberRole)
  role?: MemberRole;

  @IsOptional()
  @IsString()
  title?: string;
}
```

- [ ] **Crear business-members.service.ts**

```typescript
// backend/src/modules/business-members/business-members.service.ts
import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Resend } from 'resend';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PlanService } from '../plan/plan.service';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';

@Injectable()
export class BusinessMembersService {
  private resend: Resend | null;

  constructor(
    private prisma: PrismaService,
    private planService: PlanService,
    private config: ConfigService,
  ) {
    const key = this.config.get<string>('RESEND_API_KEY');
    this.resend = key ? new Resend(key) : null;
  }

  private async assertOwner(userId: string, businessId: string) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { userId: true, name: true },
    });
    if (!business) throw new NotFoundException('Empresa no encontrada');
    if (business.userId !== userId) throw new ForbiddenException('Solo el propietario puede gestionar el equipo');
    return business;
  }

  async listMembers(userId: string, businessId: string) {
    await this.planService.assertBusinessAccess(userId, businessId);
    const [business, members, invites] = await Promise.all([
      this.prisma.business.findUnique({ where: { id: businessId }, select: { userId: true } }),
      this.prisma.businessMember.findMany({
        where: { businessId },
        include: { user: { select: { id: true, email: true, name: true } } },
        orderBy: { invitedAt: 'asc' },
      }),
      this.prisma.businessInvite.findMany({
        where: { businessId, usedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { id: 'asc' },
      }),
    ]);
    return { ownerUserId: business!.userId, members, pendingInvites: invites };
  }

  async invite(userId: string, businessId: string, dto: InviteMemberDto) {
    const business = await this.assertOwner(userId, businessId);
    await this.planService.assertCanAddMember(userId, businessId);

    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');

    const existingUser = await this.prisma.user.findUnique({ where: { email: dto.email }, select: { id: true, email: true, name: true } });

    if (existingUser) {
      const alreadyMember = await this.prisma.businessMember.findUnique({
        where: { businessId_userId: { businessId, userId: existingUser.id } },
      });
      if (alreadyMember) throw new BadRequestException('Este usuario ya es miembro de la empresa');
      if (existingUser.id === userId) throw new BadRequestException('No puedes invitarte a ti mismo');

      const member = await this.prisma.businessMember.create({
        data: { businessId, userId: existingUser.id, role: dto.role, title: dto.title },
        include: { user: { select: { id: true, email: true, name: true } } },
      });

      if (this.resend) {
        await this.resend.emails.send({
          from: 'Nomi <noreply@nomi.co>',
          to: existingUser.email,
          subject: `Te han añadido a ${business.name} en Nomi`,
          html: `<p>Hola ${existingUser.name ?? ''},</p><p>Ahora tienes acceso a <strong>${business.name}</strong> en Nomi como <strong>${dto.role === 'EDITOR' ? 'Editor' : 'Visualizador'}</strong>.</p><p><a href="${frontendUrl}/empresas">Ver mis empresas</a></p>`,
        });
      }
      return member;
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

    await this.prisma.businessInvite.create({
      data: { businessId, email: dto.email, role: dto.role, title: dto.title, token, expiresAt },
    });

    if (this.resend) {
      const inviteUrl = `${frontendUrl}/invites/${token}`;
      await this.resend.emails.send({
        from: 'Nomi <noreply@nomi.co>',
        to: dto.email,
        subject: `Invitación a ${business.name} en Nomi`,
        html: `<p>Te han invitado a gestionar <strong>${business.name}</strong> en Nomi.</p><p><a href="${inviteUrl}">Aceptar invitación</a></p><p>Este enlace expira en 72 horas.</p>`,
      });
    }

    return { invited: true, email: dto.email, expiresAt };
  }

  async updateMember(userId: string, businessId: string, memberId: string, dto: UpdateMemberDto) {
    await this.assertOwner(userId, businessId);
    const member = await this.prisma.businessMember.findUnique({ where: { id: memberId } });
    if (!member || member.businessId !== businessId) throw new NotFoundException('Miembro no encontrado');
    return this.prisma.businessMember.update({ where: { id: memberId }, data: dto, include: { user: { select: { id: true, email: true, name: true } } } });
  }

  async removeMember(userId: string, businessId: string, memberId: string) {
    await this.assertOwner(userId, businessId);
    const member = await this.prisma.businessMember.findUnique({ where: { id: memberId } });
    if (!member || member.businessId !== businessId) throw new NotFoundException('Miembro no encontrado');
    return this.prisma.businessMember.delete({ where: { id: memberId } });
  }

  async cancelInvite(userId: string, businessId: string, inviteId: string) {
    await this.assertOwner(userId, businessId);
    const invite = await this.prisma.businessInvite.findUnique({ where: { id: inviteId } });
    if (!invite || invite.businessId !== businessId) throw new NotFoundException('Invitación no encontrada');
    return this.prisma.businessInvite.delete({ where: { id: inviteId } });
  }

  async transferOwnership(userId: string, businessId: string, newOwnerMemberId: string) {
    const business = await this.assertOwner(userId, businessId);
    const member = await this.prisma.businessMember.findUnique({ where: { id: newOwnerMemberId } });
    if (!member || member.businessId !== businessId) throw new NotFoundException('Miembro no encontrado');

    await this.prisma.$transaction([
      this.prisma.business.update({ where: { id: businessId }, data: { userId: member.userId } }),
      this.prisma.businessMember.delete({ where: { id: newOwnerMemberId } }),
      this.prisma.businessMember.create({ data: { businessId, userId, role: 'EDITOR', title: 'Propietario anterior' } }),
    ]);

    return { transferred: true, newOwnerUserId: member.userId };
  }

  async validateInviteToken(token: string) {
    const invite = await this.prisma.businessInvite.findUnique({
      where: { token },
      include: { business: { select: { name: true } } },
    });
    if (!invite) throw new NotFoundException('Invitación no encontrada');
    if (invite.usedAt) throw new BadRequestException('Esta invitación ya fue usada');
    if (invite.expiresAt < new Date()) throw new BadRequestException('Esta invitación ha expirado');
    return invite;
  }

  async acceptInvite(token: string, userId: string) {
    const invite = await this.validateInviteToken(token);

    const alreadyMember = await this.prisma.businessMember.findUnique({
      where: { businessId_userId: { businessId: invite.businessId, userId } },
    });
    if (alreadyMember) throw new BadRequestException('Ya eres miembro de esta empresa');

    await this.prisma.$transaction([
      this.prisma.businessMember.create({
        data: { businessId: invite.businessId, userId, role: invite.role, title: invite.title },
      }),
      this.prisma.businessInvite.update({ where: { id: invite.id }, data: { usedAt: new Date() } }),
    ]);

    return { accepted: true, businessId: invite.businessId };
  }
}
```

- [ ] **Crear business-members.module.ts**

```typescript
// backend/src/modules/business-members/business-members.module.ts
import { Module } from '@nestjs/common';
import { BusinessMembersService } from './business-members.service';
import { BusinessMembersController } from './business-members.controller';
import { PlanModule } from '../plan/plan.module';

@Module({
  imports: [PlanModule],
  controllers: [BusinessMembersController],
  providers: [BusinessMembersService],
})
export class BusinessMembersModule {}
```

- [ ] **Commit parcial**

```bash
git add backend/src/modules/business-members/
git commit -m "feat: add BusinessMembersService with invite, remove, transfer logic"
```

---

### Task 15: BusinessMembersController

**Files:**
- Create: `backend/src/modules/business-members/business-members.controller.ts`
- Modify: `backend/src/app.module.ts`

- [ ] **Crear business-members.controller.ts**

```typescript
// backend/src/modules/business-members/business-members.controller.ts
import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { BusinessMembersService } from './business-members.service';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Business Members')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('businesses/:id/members')
export class BusinessMembersController {
  constructor(private service: BusinessMembersService) {}

  @Get()
  list(@CurrentUser() user: { id: string }, @Param('id') businessId: string) {
    return this.service.listMembers(user.id, businessId);
  }

  @Post('invite')
  invite(@CurrentUser() user: { id: string }, @Param('id') businessId: string, @Body() dto: InviteMemberDto) {
    return this.service.invite(user.id, businessId, dto);
  }

  @Patch(':memberId')
  update(@CurrentUser() user: { id: string }, @Param('id') businessId: string, @Param('memberId') memberId: string, @Body() dto: UpdateMemberDto) {
    return this.service.updateMember(user.id, businessId, memberId, dto);
  }

  @Delete(':memberId')
  remove(@CurrentUser() user: { id: string }, @Param('id') businessId: string, @Param('memberId') memberId: string) {
    return this.service.removeMember(user.id, businessId, memberId);
  }

  @Delete('invites/:inviteId')
  cancelInvite(@CurrentUser() user: { id: string }, @Param('id') businessId: string, @Param('inviteId') inviteId: string) {
    return this.service.cancelInvite(user.id, businessId, inviteId);
  }

  @Post('transfer')
  transfer(@CurrentUser() user: { id: string }, @Param('id') businessId: string, @Body() body: { memberId: string }) {
    return this.service.transferOwnership(user.id, businessId, body.memberId);
  }
}
```

Añadir también el controller de invitaciones:

```typescript
// Añadir al final del mismo archivo o crear invites.controller.ts separado en src/modules/business-members/
// Por brevedad, añadir en business-members.controller.ts con un controller adicional:
```

Crear `backend/src/modules/business-members/invites.controller.ts`:

```typescript
import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { BusinessMembersService } from './business-members.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Invites')
@Controller('invites')
export class InvitesController {
  constructor(private service: BusinessMembersService) {}

  @Get(':token')
  validate(@Param('token') token: string) {
    return this.service.validateInviteToken(token);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':token/accept')
  accept(@Param('token') token: string, @CurrentUser() user: { id: string }) {
    return this.service.acceptInvite(token, user.id);
  }
}
```

Añadir `InvitesController` al módulo:

```typescript
// En business-members.module.ts, añadir InvitesController:
import { InvitesController } from './invites.controller';

@Module({
  imports: [PlanModule],
  controllers: [BusinessMembersController, InvitesController],
  providers: [BusinessMembersService],
})
export class BusinessMembersModule {}
```

- [ ] **Registrar BusinessMembersModule en AppModule**

En `backend/src/app.module.ts`, añadir:
```typescript
import { BusinessMembersModule } from './modules/business-members/business-members.module';
```

Y en `imports`:
```typescript
    BusinessMembersModule,
```

- [ ] **Añadir RESEND_API_KEY y FRONTEND_URL a las variables de entorno**

En `backend/.env` (desarrollo local):
```
RESEND_API_KEY=           # vacío en local → emails no se envían
FRONTEND_URL=http://localhost:3000
```

En Railway (producción): añadir `RESEND_API_KEY` con la key real y `FRONTEND_URL=https://tu-dominio.vercel.app`

- [ ] **Verificar compilación**

```bash
cd /Users/sebastiansalgado/Documents/finanzas/backend && node_modules/.bin/tsc --noEmit
```

- [ ] **Commit**

```bash
git add backend/src/modules/business-members/ backend/src/app.module.ts
git commit -m "feat: add BusinessMembersController and InvitesController"
```

---

### Task 16: Actualizar PlanService.assertBusinessAccess para miembros

**Files:**
- Modify: `backend/src/modules/plan/plan.service.ts`

- [ ] **Actualizar assertBusinessAccess para aceptar miembros**

Reemplazar el método `assertBusinessAccess` en `plan.service.ts`:

```typescript
  async assertBusinessAccess(userId: string, businessId: string): Promise<void> {
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
```

- [ ] **Actualizar las llamadas create() en todos los servicios para usar assertWriteAccess**

En cada servicio que tenga `assertCanCreate*`, reemplazar `businessesService.findOne(userId, businessId)` con `planService.assertWriteAccess(userId, businessId)`:

```typescript
// invoices.service.ts — método create():
await this.planService.assertWriteAccess(userId, businessId);
await this.planService.assertCanCreateInvoice(userId, businessId);
// ELIMINAR: await this.businessesService.findOne(userId, businessId);

// customers.service.ts — método create():
await this.planService.assertWriteAccess(userId, businessId);
await this.planService.assertCanCreateCustomer(userId, businessId);

// products.service.ts — método create():
await this.planService.assertWriteAccess(userId, businessId);
await this.planService.assertCanCreateProduct(userId, businessId);

// quotes.service.ts — método create():
await this.planService.assertWriteAccess(userId, businessId);
await this.planService.assertCanCreateQuotation(userId, businessId);

// suppliers.service.ts — método create():
await this.planService.assertWriteAccess(userId, businessId);
await this.planService.assertCanCreateSupplier(userId, businessId);

// price-lists.service.ts — método create():
await this.planService.assertWriteAccess(userId, businessId);
await this.planService.assertCanUsePriceLists(userId);
```

Para las operaciones de lectura en esos mismos servicios (findAll, findOne), reemplazar `businessesService.findOne` con `planService.assertBusinessAccess`.

- [ ] **Verificar compilación**

```bash
cd /Users/sebastiansalgado/Documents/finanzas/backend && node_modules/.bin/tsc --noEmit
```

- [ ] **Commit**

```bash
git add backend/src/modules/plan/plan.service.ts backend/src/modules/invoices/ backend/src/modules/customers/ backend/src/modules/products/ backend/src/modules/quotes/ backend/src/modules/suppliers/ backend/src/modules/price-lists/
git commit -m "feat: extend assertBusinessAccess to support team members"
```

---

### Task 17: Actualizar /businesses/findAll para incluir empresas compartidas

**Files:**
- Modify: `backend/src/modules/businesses/businesses.service.ts`

- [ ] **Actualizar findAll para devolver también empresas donde el usuario es miembro**

En `backend/src/modules/businesses/businesses.service.ts`, reemplazar `findAll`:

```typescript
  async findAll(userId: string) {
    const [ownedBusinesses, memberBusinesses] = await Promise.all([
      this.prisma.business.findMany({
        where: { userId, isActive: true },
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { customers: true, invoices: true, bizTransactions: true } } },
      }),
      this.prisma.businessMember.findMany({
        where: { userId },
        include: {
          business: {
            include: { _count: { select: { customers: true, invoices: true, bizTransactions: true } } },
          },
        },
      }),
    ]);

    const shared = memberBusinesses
      .filter(m => m.business.isActive)
      .map(m => ({ ...m.business, memberRole: m.role, memberTitle: m.title }));

    return [
      ...ownedBusinesses.map(b => ({ ...b, memberRole: 'OWNER' as const })),
      ...shared,
    ];
  }
```

- [ ] **Commit**

```bash
git add backend/src/modules/businesses/businesses.service.ts
git commit -m "feat: include shared businesses in findAll response"
```

---

### Task 18: Frontend — página /empresas/[id]/equipo

**Files:**
- Create: `frontend/src/app/(dashboard)/empresas/[id]/equipo/page.tsx`

- [ ] **Crear equipo/page.tsx**

```tsx
// frontend/src/app/(dashboard)/empresas/[id]/equipo/page.tsx
'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/axios';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, UserCheck, X, AlertTriangle } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { usePlan } from '@/context/PlanContext';
import { useAuth } from '@/context/auth.context';

interface Member { id: string; role: 'EDITOR' | 'VIEWER'; title: string | null; user: { id: string; email: string; name: string | null } }
interface Invite { id: string; email: string; role: 'EDITOR' | 'VIEWER'; expiresAt: string }
interface TeamData { ownerUserId: string; members: Member[]; pendingInvites: Invite[] }

const inputCls = 'w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition text-sm';

export default function EquipoPage() {
  const { id: businessId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { usage } = usePlan();
  const [showInvite, setShowInvite] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<Member | null>(null);
  const [confirmTransfer, setConfirmTransfer] = useState<Member | null>(null);

  const { data, isLoading } = useQuery<TeamData>({
    queryKey: ['members', businessId],
    queryFn: async () => (await api.get(`/businesses/${businessId}/members`)).data,
    enabled: !!businessId,
  });

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<{ email: string; role: 'EDITOR' | 'VIEWER'; title: string }>();

  const inviteMutation = useMutation({
    mutationFn: (d: { email: string; role: string; title: string }) => api.post(`/businesses/${businessId}/members/invite`, d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['members', businessId] }); queryClient.invalidateQueries({ queryKey: ['usage', businessId] }); setShowInvite(false); reset(); },
  });

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => api.delete(`/businesses/${businessId}/members/${memberId}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['members', businessId] }); queryClient.invalidateQueries({ queryKey: ['usage', businessId] }); setConfirmRemove(null); },
  });

  const cancelInviteMutation = useMutation({
    mutationFn: (inviteId: string) => api.delete(`/businesses/${businessId}/members/invites/${inviteId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['members', businessId] }),
  });

  const transferMutation = useMutation({
    mutationFn: (memberId: string) => api.post(`/businesses/${businessId}/members/transfer`, { memberId }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['members', businessId] }); setConfirmTransfer(null); },
  });

  const isOwner = data?.ownerUserId === user?.id;
  const canInvite = isOwner && (usage?.memberLimit === null || (usage?.membersCount ?? 0) < (usage?.memberLimit ?? 0));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <nav className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/empresas/${businessId}`} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"><ArrowLeft size={20} /></Link>
            <span className="font-semibold text-gray-900 dark:text-white">Equipo</span>
          </div>
          <ThemeToggle />
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">

        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {(data?.members.length ?? 0) + 1} miembro(s) activo(s)
            {usage?.memberLimit !== null && ` · ${usage?.membersCount ?? 0}/${usage?.memberLimit} adicionales`}
          </p>
          {isOwner && canInvite && (
            <button onClick={() => setShowInvite(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition text-sm">
              <Plus size={16} /> Invitar
            </button>
          )}
        </div>

        {showInvite && (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">Invitar colaborador</h3>
              <button onClick={() => { setShowInvite(false); reset(); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit(d => inviteMutation.mutate(d))} className="space-y-3">
              <input {...register('email', { required: true })} type="email" placeholder="correo@ejemplo.com" className={inputCls} />
              <select {...register('role', { required: true })} className={inputCls}>
                <option value="EDITOR">Editor — puede crear y editar</option>
                <option value="VIEWER">Visualizador — solo lectura</option>
              </select>
              <input {...register('title')} placeholder="Cargo o descripción (opcional)" className={inputCls} />
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => { setShowInvite(false); reset(); }} className="flex-1 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition">Cancelar</button>
                <button type="submit" disabled={isSubmitting} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2 rounded-lg text-sm font-medium transition">{isSubmitting ? 'Enviando...' : 'Enviar invitación'}</button>
              </div>
            </form>
          </div>
        )}

        <div className="space-y-3">
          {/* Propietario */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                <UserCheck size={16} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{user?.id === data?.ownerUserId ? 'Tú' : data?.ownerUserId}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">{user?.email}</p>
              </div>
            </div>
            <span className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-1 rounded-full font-medium">Propietario</span>
          </div>

          {/* Miembros */}
          {data?.members.map(m => (
            <div key={m.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center text-sm font-medium text-gray-600 dark:text-gray-300">
                  {(m.user.name ?? m.user.email)[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{m.user.name ?? m.user.email}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{m.title ?? m.user.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${m.role === 'EDITOR' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
                  {m.role === 'EDITOR' ? 'Editor' : 'Visualizador'}
                </span>
                {isOwner && (
                  <>
                    <button onClick={() => setConfirmTransfer(m)} className="p-1.5 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition" title="Transferir propiedad"><UserCheck size={15} /></button>
                    <button onClick={() => setConfirmRemove(m)} className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition"><Trash2 size={15} /></button>
                  </>
                )}
              </div>
            </div>
          ))}

          {/* Invitaciones pendientes */}
          {(data?.pendingInvites.length ?? 0) > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2 mt-4">Invitaciones pendientes</p>
              {data?.pendingInvites.map(inv => (
                <div key={inv.id} className="bg-white dark:bg-gray-900 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{inv.email}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{inv.role === 'EDITOR' ? 'Editor' : 'Visualizador'} · Expira {new Date(inv.expiresAt).toLocaleDateString('es-CO')}</p>
                  </div>
                  {isOwner && <button onClick={() => cancelInviteMutation.mutate(inv.id)} className="text-xs text-red-500 hover:text-red-600 transition">Cancelar</button>}
                </div>
              ))}
            </div>
          )}
        </div>

        <ConfirmDialog
          open={!!confirmRemove}
          title="Expulsar miembro"
          message={`¿Eliminar el acceso de ${confirmRemove?.user.name ?? confirmRemove?.user.email} a esta empresa?`}
          confirmLabel="Expulsar"
          onConfirm={() => confirmRemove && removeMutation.mutate(confirmRemove.id)}
          onCancel={() => setConfirmRemove(null)}
        />

        <ConfirmDialog
          open={!!confirmTransfer}
          title="Transferir propiedad"
          message={`Vas a transferir la propiedad a ${confirmTransfer?.user.name ?? confirmTransfer?.user.email}. Perderás la capacidad de gestionar el equipo, eliminar la empresa y cambiar configuraciones. Pasarás a ser Editor. Esta acción no se puede deshacer sin que el nuevo propietario te la devuelva.`}
          confirmLabel="Transferir"
          onConfirm={() => confirmTransfer && transferMutation.mutate(confirmTransfer.id)}
          onCancel={() => setConfirmTransfer(null)}
        />

      </main>
    </div>
  );
}
```

- [ ] **Añadir acceso al módulo de equipo en el dashboard de empresa**

En `frontend/src/app/(dashboard)/empresas/[id]/page.tsx`, añadir al array `getNavItems`:

```typescript
  {
    href: `/empresas/${id}/equipo`, label: 'Equipo', desc: 'Colaboradores y roles',
    icon: Users2,
    bg: 'bg-indigo-50 dark:bg-indigo-900/20', border: 'border-indigo-100 dark:border-indigo-800/40',
    iconBg: 'bg-indigo-100 dark:bg-indigo-800/40', iconCl: 'text-indigo-600 dark:text-indigo-400',
  },
```

Añadir `Users2` al import de lucide-react.

- [ ] **Verificar compilación frontend**

```bash
cd /Users/sebastiansalgado/Documents/finanzas/frontend && node_modules/.bin/tsc --noEmit
```

- [ ] **Commit**

```bash
git add frontend/src/app/(dashboard)/empresas/[id]/equipo/ frontend/src/app/(dashboard)/empresas/[id]/page.tsx
git commit -m "feat: add /equipo page for team member management"
```

---

## FASE 3 — Wompi (Task 19-20)

---

### Task 19: SubscriptionsModule stub

**Files:**
- Create: `backend/src/modules/subscriptions/subscriptions.service.ts`
- Create: `backend/src/modules/subscriptions/subscriptions.controller.ts`
- Create: `backend/src/modules/subscriptions/subscriptions.module.ts`

- [ ] **Crear subscriptions.service.ts**

```typescript
// backend/src/modules/subscriptions/subscriptions.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { createHmac } from 'crypto';

@Injectable()
export class SubscriptionsService {
  private wompiPrivateKey: string;
  private wompiEventsSecret: string;
  private wompiPublicKey: string;
  private frontendUrl: string;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.wompiPrivateKey  = this.config.get('WOMPI_PRIVATE_KEY', '');
    this.wompiEventsSecret = this.config.get('WOMPI_EVENTS_SECRET', '');
    this.wompiPublicKey   = this.config.get('WOMPI_PUBLIC_KEY', '');
    this.frontendUrl      = this.config.get('FRONTEND_URL', 'http://localhost:3000');
  }

  async createCheckout(userId: string, plan: 'PRO' | 'EMPRESA') {
    if (!this.wompiPrivateKey) {
      return { status: 'GATEWAY_PENDING' };
    }

    const PRICES = { PRO: 1690000, EMPRESA: 3490000 }; // en centavos COP
    const amountInCents = PRICES[plan];
    const reference = `nomi-${userId}-${plan}-${Date.now()}`;
    const redirectUrl = `${this.frontendUrl}/planes?status=success`;

    const response = await fetch('https://production.wompi.co/v1/payment_links', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.wompiPrivateKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `Nomi ${plan}`,
        description: `Suscripción mensual a Nomi ${plan}`,
        single_use: true,
        collect_shipping: false,
        currency: 'COP',
        amount_in_cents: amountInCents,
        redirect_url: redirectUrl,
        reference,
      }),
    });

    if (!response.ok) {
      throw new BadRequestException('Error al crear el enlace de pago');
    }

    const data = await response.json() as { data: { payment_link: { id: string } } };
    const linkId = data.data.payment_link.id;
    return { url: `https://checkout.wompi.co/l/${linkId}` };
  }

  async handleWebhook(payload: Record<string, unknown>, signature: string) {
    if (!this.wompiEventsSecret) return { received: true };

    const checksumStr = `${JSON.stringify(payload)}${this.wompiEventsSecret}`;
    const expected = createHmac('sha256', this.wompiEventsSecret)
      .update(checksumStr)
      .digest('hex');

    if (signature !== expected) {
      throw new BadRequestException('Firma inválida');
    }

    const event = payload as { event: string; data: { transaction: { status: string; reference: string } } };
    if (event.event === 'transaction.updated' && event.data.transaction.status === 'APPROVED') {
      const ref = event.data.transaction.reference;
      const parts = ref.split('-');
      const userId = parts[1];
      const plan = parts[2] as 'PRO' | 'EMPRESA';

      const planExpiresAt = new Date();
      planExpiresAt.setDate(planExpiresAt.getDate() + 30);

      await this.prisma.user.update({
        where: { id: userId },
        data: { plan, planExpiresAt, planStartedAt: new Date() },
      });
    }

    return { received: true };
  }

  async getStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, planExpiresAt: true, planStartedAt: true },
    });
    return user;
  }
}
```

- [ ] **Crear subscriptions.controller.ts**

```typescript
// backend/src/modules/subscriptions/subscriptions.controller.ts
import { Controller, Post, Get, Body, Headers, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Subscriptions')
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private service: SubscriptionsService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('checkout')
  checkout(@CurrentUser() user: { id: string }, @Body() body: { plan: 'PRO' | 'EMPRESA' }) {
    return this.service.createCheckout(user.id, body.plan);
  }

  @Post('webhook')
  webhook(@Body() payload: Record<string, unknown>, @Headers('x-event-checksum') signature: string) {
    return this.service.handleWebhook(payload, signature);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('status')
  status(@CurrentUser() user: { id: string }) {
    return this.service.getStatus(user.id);
  }
}
```

- [ ] **Crear subscriptions.module.ts**

```typescript
// backend/src/modules/subscriptions/subscriptions.module.ts
import { Module } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';

@Module({
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService],
})
export class SubscriptionsModule {}
```

- [ ] **Registrar en AppModule**

```typescript
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
// En imports: SubscriptionsModule,
```

- [ ] **Verificar compilación**

```bash
cd /Users/sebastiansalgado/Documents/finanzas/backend && node_modules/.bin/tsc --noEmit
```

- [ ] **Commit**

```bash
git add backend/src/modules/subscriptions/ backend/src/app.module.ts
git commit -m "feat: add SubscriptionsModule with Wompi checkout and webhook stubs"
```

---

### Task 20: Self-review del plan

- [ ] **Verificar cobertura del spec**

  - [x] Prisma: PlanType en User, BusinessMember, BusinessInvite ← Task 1
  - [x] JWT incluye plan ← Task 2
  - [x] PlanService con todos los assert* y getUsage ← Task 3
  - [x] Límites en invoices, customers, products, quotes, suppliers, businesses, price-lists ← Task 4-5
  - [x] GET /businesses/:id/usage ← Task 6
  - [x] upgradeModalBus + interceptor Axios ← Task 7
  - [x] PlanContext / usePlan ← Task 8
  - [x] Layout PlanProvider + UpgradeModalProvider ← Task 9
  - [x] UpgradeModal ← Task 10
  - [x] UsageCard en dashboard ← Task 11
  - [x] PlanGate en listas-precios ← Task 12
  - [x] Página /planes ← Task 13
  - [x] BusinessMembersService (invite, remove, transfer, accept) ← Task 14
  - [x] BusinessMembersController + InvitesController ← Task 15
  - [x] assertBusinessAccess acepta miembros ← Task 16
  - [x] findAll devuelve empresas compartidas ← Task 17
  - [x] Página /equipo ← Task 18
  - [x] SubscriptionsModule Wompi stub ← Task 19
  - [x] /checkout page ← Task 13 (incluida)

- [ ] **Verificar compilación final completa**

```bash
cd /Users/sebastiansalgado/Documents/finanzas/backend && node_modules/.bin/tsc --noEmit && echo "Backend OK"
cd /Users/sebastiansalgado/Documents/finanzas/frontend && node_modules/.bin/tsc --noEmit && echo "Frontend OK"
```

- [ ] **Commit final de limpieza si aplica**

```bash
git add -A
git commit -m "chore: freemium gating system complete — awaiting Wompi credentials"
```
