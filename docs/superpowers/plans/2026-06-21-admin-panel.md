# Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir un panel de administración en `/admin` que permita gestionar usuarios, activar cuentas staff (con acceso ilimitado), cambiar planes manualmente, ver estadísticas de ingresos reales vs. planes regalados, y consultar el historial de cambios de plan.

**Architecture:** Se añaden dos campos al modelo `User` (`isStaff`, `planGrantedByAdmin`) y un nuevo modelo `PlanHistory`. El backend NestJS expone un `AdminModule` protegido por un `AdminGuard` que verifica `isStaff`. El `PlanService` revisa `isStaff` antes de aplicar cualquier límite. El frontend tiene una ruta `/admin` protegida con tabla de usuarios, estadísticas de MRR y historial.

**Tech Stack:** NestJS + Prisma + PostgreSQL (backend) · Next.js 14 App Router + TanStack React Query + Tailwind (frontend)

---

## File Map

**Backend — crear:**
- `backend/src/modules/admin/dto/change-plan.dto.ts`
- `backend/src/modules/admin/dto/toggle-staff.dto.ts`
- `backend/src/modules/admin/admin.service.ts`
- `backend/src/modules/admin/admin.controller.ts`
- `backend/src/modules/admin/admin.module.ts`
- `backend/src/modules/admin/guards/admin.guard.ts`

**Backend — modificar:**
- `backend/prisma/schema.prisma` — añadir campos `isStaff`, `planGrantedByAdmin` a User; añadir modelo `PlanHistory`
- `backend/src/modules/auth/strategies/jwt.strategy.ts` — añadir `isStaff` al select
- `backend/src/modules/auth/auth.service.ts` — añadir `isStaff` a `buildTokenResponse`
- `backend/src/modules/plan/plan.service.ts` — bypass para usuarios staff
- `backend/src/app.module.ts` — registrar AdminModule

**Frontend — crear:**
- `frontend/src/app/(dashboard)/admin/page.tsx`

**Frontend — modificar:**
- `frontend/src/types/auth.types.ts` — añadir `isStaff: boolean` a `User`
- `frontend/src/components/ui/UserMenu.tsx` — añadir link "Admin" condicional

---

## Task 1: Schema — isStaff, planGrantedByAdmin y PlanHistory

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Añadir campos a User y modelo PlanHistory**

En `backend/prisma/schema.prisma`, dentro del modelo `User`, añadir estas dos líneas justo después de `planStartedAt DateTime?`:

```prisma
  isStaff            Boolean   @default(false)
  planGrantedByAdmin Boolean   @default(false)
  planHistory        PlanHistory[] @relation("UserPlanHistory")
  adminChanges       PlanHistory[] @relation("AdminChanges")
```

Luego añadir el modelo `PlanHistory` al final del archivo (antes del último `}`), después del modelo `BusinessInvite`:

```prisma
// ─── Admin: Historial de cambios de plan ─────────────────────────────────────

model PlanHistory {
  id             String    @id @default(uuid())
  userId         String
  user           User      @relation("UserPlanHistory", fields: [userId], references: [id], onDelete: Cascade)
  fromPlan       PlanType
  toPlan         PlanType
  changedById    String?
  changedBy      User?     @relation("AdminChanges", fields: [changedById], references: [id], onDelete: SetNull)
  grantedByAdmin Boolean   @default(false)
  note           String?
  createdAt      DateTime  @default(now())

  @@index([userId])
  @@index([createdAt])
  @@map("plan_history")
}
```

- [ ] **Step 2: Generar y aplicar la migración**

```bash
cd /Users/sebastiansalgado/Documents/finanzas/backend
npx prisma migrate dev --name add_admin_fields_and_plan_history
```

Esperado: migración aplicada, `prisma generate` corre automáticamente.

- [ ] **Step 3: Verificar compilación**

```bash
cd /Users/sebastiansalgado/Documents/finanzas/backend && npx tsc --noEmit 2>&1; echo "exit: $?"
```

Esperado: `exit: 0`

- [ ] **Step 4: Commit**

```bash
cd /Users/sebastiansalgado/Documents/finanzas
git add backend/prisma/
git commit -m "feat(admin): add isStaff, planGrantedByAdmin fields and PlanHistory model"
```

---

## Task 2: JWT — añadir isStaff al token y al User frontend

**Files:**
- Modify: `backend/src/modules/auth/strategies/jwt.strategy.ts`
- Modify: `backend/src/modules/auth/auth.service.ts`
- Modify: `frontend/src/types/auth.types.ts`

**Contexto:** El JWT actualmente contiene `{ sub, email }` en el payload. El `validate()` del strategy retorna `{ id, email, name, plan }`. Necesitamos añadir `isStaff` en todo el flujo para que el frontend pueda proteger `/admin` sin llamadas extra.

- [ ] **Step 1: Actualizar jwt.strategy.ts**

En `backend/src/modules/auth/strategies/jwt.strategy.ts`, en el método `validate()`, cambiar el `select` para incluir `isStaff`:

```typescript
const user = await this.prisma.user.findUnique({
  where: { id: payload.sub },
  select: { id: true, email: true, name: true, plan: true, isStaff: true },
});
```

El `return user;` no cambia — retorna el objeto completo incluyendo `isStaff`.

- [ ] **Step 2: Actualizar buildTokenResponse en auth.service.ts**

En `backend/src/modules/auth/auth.service.ts`, cambiar la firma y el return de `buildTokenResponse`:

```typescript
private buildTokenResponse(user: {
  id: string;
  email: string;
  name: string | null;
  plan: import('@prisma/client').PlanType;
  isStaff: boolean;
}) {
  const payload: JwtPayload = { sub: user.id, email: user.email };

  return {
    accessToken: this.jwtService.sign(payload),
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      isStaff: user.isStaff,
    },
  };
}
```

Luego en el método `register()`, añadir `isStaff: true` al `select`:

```typescript
select: { id: true, email: true, name: true, plan: true, isStaff: true },
```

Y en `login()`, añadir `isStaff: true` al `select` también:

```typescript
select: { id: true, email: true, name: true, plan: true, passwordHash: true, isStaff: true },
```

Y en la llamada a `buildTokenResponse` dentro de `login()`, pasar también `isStaff: user.isStaff`:

```typescript
return this.buildTokenResponse({
  id: user.id,
  email: user.email,
  name: user.name,
  plan: user.plan,
  isStaff: user.isStaff,
});
```

- [ ] **Step 3: Actualizar User type en frontend**

En `frontend/src/types/auth.types.ts`, añadir `isStaff` a la interfaz `User`:

```typescript
export interface User {
  id: string;
  email: string;
  name: string | null;
  plan: 'FREE' | 'PRO' | 'EMPRESA';
  isStaff: boolean;
}
```

- [ ] **Step 4: Verificar compilación**

```bash
cd /Users/sebastiansalgado/Documents/finanzas/backend && npx tsc --noEmit 2>&1; echo "backend: $?"
cd /Users/sebastiansalgado/Documents/finanzas/frontend && npx tsc --noEmit 2>&1; echo "frontend: $?"
```

Esperado: ambos `exit: 0`

- [ ] **Step 5: Commit**

```bash
cd /Users/sebastiansalgado/Documents/finanzas
git add backend/src/modules/auth/ frontend/src/types/auth.types.ts
git commit -m "feat(admin): include isStaff in JWT response and User type"
```

---

## Task 3: PlanService — bypass para usuarios staff

**Files:**
- Modify: `backend/src/modules/plan/plan.service.ts`

**Contexto:** Actualmente `getUserPlan()` solo retorna el plan. Necesitamos que también retorne `isStaff`. Todos los métodos `assertCan*`, `assertBusinessAccess` y `assertWriteAccess` deben retornar inmediatamente si `isStaff === true`.

- [ ] **Step 1: Actualizar getUserPlan para retornar isStaff**

Reemplazar el método privado `getUserPlan`:

```typescript
private async getUserPlan(userId: string): Promise<{ plan: import('@prisma/client').PlanType; isStaff: boolean }> {
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true, isStaff: true },
  });
  if (!user) throw new NotFoundException('Usuario no encontrado');
  return { plan: user.plan, isStaff: user.isStaff };
}
```

- [ ] **Step 2: Actualizar assertBusinessAccess**

```typescript
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
```

- [ ] **Step 3: Actualizar assertWriteAccess**

```typescript
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
```

- [ ] **Step 4: Actualizar todos los assertCan* para bypass staff**

Para cada método `assertCan*`, añadir el bypass al inicio. Leer el archivo completo para encontrarlos todos. El patrón es el mismo en cada uno:

**assertCanCreateInvoice:**
```typescript
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
```

**assertCanCreateCustomer:**
```typescript
async assertCanCreateCustomer(userId: string, businessId: string): Promise<void> {
  const { plan, isStaff } = await this.getUserPlan(userId);
  if (isStaff) return;
  const limit = LIMITS[plan].customers;
  if (limit === null) return;
  const count = await this.prisma.customer.count({ where: { businessId } });
  if (count >= limit) throw new ForbiddenException('CUSTOMER_LIMIT_REACHED');
}
```

**assertCanCreateProduct:**
```typescript
async assertCanCreateProduct(userId: string, businessId: string): Promise<void> {
  const { plan, isStaff } = await this.getUserPlan(userId);
  if (isStaff) return;
  const limit = LIMITS[plan].products;
  if (limit === null) return;
  const count = await this.prisma.product.count({ where: { businessId, isActive: true } });
  if (count >= limit) throw new ForbiddenException('PRODUCT_LIMIT_REACHED');
}
```

**assertCanCreateQuotation:**
```typescript
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
```

**assertCanCreateSupplier:**
```typescript
async assertCanCreateSupplier(userId: string, businessId: string): Promise<void> {
  const { plan, isStaff } = await this.getUserPlan(userId);
  if (isStaff) return;
  const limit = LIMITS[plan].suppliers;
  if (limit === null) return;
  const count = await this.prisma.supplier.count({ where: { businessId, isActive: true } });
  if (count >= limit) throw new ForbiddenException('SUPPLIER_LIMIT_REACHED');
}
```

**assertCanCreateBusiness:**
```typescript
async assertCanCreateBusiness(userId: string): Promise<void> {
  const { plan, isStaff } = await this.getUserPlan(userId);
  if (isStaff) return;
  const limit = LIMITS[plan].businesses;
  if (limit === null) return;
  const count = await this.prisma.business.count({ where: { userId, isActive: true } });
  if (count >= limit) throw new ForbiddenException('BUSINESS_LIMIT_REACHED');
}
```

**assertCanUsePriceLists:**
```typescript
async assertCanUsePriceLists(userId: string): Promise<void> {
  const { plan, isStaff } = await this.getUserPlan(userId);
  if (isStaff) return;
  if (plan === 'FREE') throw new ForbiddenException('PRICE_LISTS_REQUIRE_PRO');
}
```

**assertCanAddMember:**
```typescript
async assertCanAddMember(userId: string, businessId: string): Promise<void> {
  const { plan, isStaff } = await this.getUserPlan(userId);
  if (isStaff) return;
  const limit = LIMITS[plan].members;
  if (limit === null) return;
  if (limit === 0) throw new ForbiddenException('MEMBER_LIMIT_REACHED');
  const count = await this.prisma.businessMember.count({ where: { businessId } });
  if (count >= limit) throw new ForbiddenException('MEMBER_LIMIT_REACHED');
}
```

- [ ] **Step 5: Verificar compilación**

```bash
cd /Users/sebastiansalgado/Documents/finanzas/backend && npx tsc --noEmit 2>&1; echo "exit: $?"
```

Esperado: `exit: 0`

- [ ] **Step 6: Commit**

```bash
cd /Users/sebastiansalgado/Documents/finanzas
git add backend/src/modules/plan/plan.service.ts
git commit -m "feat(admin): bypass all plan limits for staff users"
```

---

## Task 4: AdminGuard + DTOs + AdminService

**Files:**
- Create: `backend/src/modules/admin/guards/admin.guard.ts`
- Create: `backend/src/modules/admin/dto/change-plan.dto.ts`
- Create: `backend/src/modules/admin/dto/toggle-staff.dto.ts`
- Create: `backend/src/modules/admin/admin.service.ts`

**Contexto:** `PrismaService` está en `backend/src/common/prisma/prisma.service.ts`. `ConfigService` viene de `@nestjs/config` (global, no hay que importar el módulo). El guard accede a `request.user` que viene del `JwtStrategy.validate()`.

- [ ] **Step 1: Crear AdminGuard**

```typescript
// backend/src/modules/admin/guards/admin.guard.ts
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    if (!req.user?.isStaff) throw new ForbiddenException('ADMIN_ONLY');
    return true;
  }
}
```

- [ ] **Step 2: Crear DTOs**

```typescript
// backend/src/modules/admin/dto/change-plan.dto.ts
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PlanType } from '@prisma/client';

export class ChangePlanDto {
  @IsEnum(PlanType)
  plan: PlanType;

  @IsOptional()
  @IsString()
  note?: string;
}
```

```typescript
// backend/src/modules/admin/dto/toggle-staff.dto.ts
import { IsBoolean } from 'class-validator';

export class ToggleStaffDto {
  @IsBoolean()
  isStaff: boolean;
}
```

- [ ] **Step 3: Crear AdminService**

```typescript
// backend/src/modules/admin/admin.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PlanType } from '@prisma/client';

const PRICES: Record<string, number> = {
  PRO: 16900,
  EMPRESA: 34900,
};

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getStats() {
    const [total, byPlan, newLast30] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.groupBy({
        by: ['plan', 'planGrantedByAdmin'],
        _count: { id: true },
      }),
      this.prisma.user.count({
        where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      }),
    ]);

    const planCount: Record<string, number> = { FREE: 0, PRO: 0, EMPRESA: 0 };
    const paidCount: Record<string, number> = { PRO: 0, EMPRESA: 0 };
    const grantedCount: Record<string, number> = { PRO: 0, EMPRESA: 0 };

    for (const row of byPlan) {
      const plan = row.plan as string;
      const count = row._count.id;
      planCount[plan] = (planCount[plan] ?? 0) + count;
      if (plan !== 'FREE') {
        if (row.planGrantedByAdmin) grantedCount[plan] = (grantedCount[plan] ?? 0) + count;
        else paidCount[plan] = (paidCount[plan] ?? 0) + count;
      }
    }

    const mrr = (paidCount.PRO ?? 0) * PRICES.PRO + (paidCount.EMPRESA ?? 0) * PRICES.EMPRESA;
    const mrrLost = (grantedCount.PRO ?? 0) * PRICES.PRO + (grantedCount.EMPRESA ?? 0) * PRICES.EMPRESA;

    return {
      totalUsers: total,
      byPlan: planCount,
      paidPlans: paidCount,
      grantedPlans: grantedCount,
      mrr,
      mrrLost,
      newUsersLast30Days: newLast30,
    };
  }

  async listUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        isStaff: true,
        planGrantedByAdmin: true,
        createdAt: true,
        _count: { select: { businesses: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async changePlan(adminId: string, userId: string, plan: PlanType, note?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const [updated] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          plan,
          planGrantedByAdmin: plan !== 'FREE',
          planStartedAt: plan !== 'FREE' ? new Date() : null,
        },
        select: { id: true, email: true, name: true, plan: true, isStaff: true, planGrantedByAdmin: true },
      }),
      this.prisma.planHistory.create({
        data: {
          userId,
          fromPlan: user.plan,
          toPlan: plan,
          changedById: adminId,
          grantedByAdmin: true,
          note: note ?? null,
        },
      }),
    ]);

    return updated;
  }

  async toggleStaff(adminId: string, userId: string, isStaff: boolean) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, isStaff: true },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const data: Record<string, unknown> = { isStaff };
    const historyEntries: Array<{ fromPlan: PlanType; toPlan: PlanType; note: string }> = [];

    if (isStaff && user.plan === 'FREE') {
      data.plan = 'EMPRESA';
      data.planGrantedByAdmin = true;
      data.planStartedAt = new Date();
      historyEntries.push({ fromPlan: 'FREE', toPlan: 'EMPRESA', note: 'Activado como staff por admin' });
    }

    if (!isStaff && user.plan !== 'FREE') {
      data.plan = 'FREE';
      data.planGrantedByAdmin = false;
      data.planStartedAt = null;
      historyEntries.push({ fromPlan: user.plan, toPlan: 'FREE', note: 'Staff desactivado por admin' });
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, email: true, name: true, plan: true, isStaff: true, planGrantedByAdmin: true },
    });

    if (historyEntries.length > 0) {
      await this.prisma.planHistory.createMany({
        data: historyEntries.map(e => ({
          userId,
          fromPlan: e.fromPlan,
          toPlan: e.toPlan,
          changedById: adminId,
          grantedByAdmin: true,
          note: e.note,
        })),
      });
    }

    return updated;
  }

  async getUserHistory(userId: string) {
    return this.prisma.planHistory.findMany({
      where: { userId },
      include: {
        changedBy: { select: { id: true, email: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getGlobalHistory(page = 1, limit = 50, userId?: string) {
    const where = userId ? { userId } : {};
    const [total, items] = await Promise.all([
      this.prisma.planHistory.count({ where }),
      this.prisma.planHistory.findMany({
        where,
        include: {
          user: { select: { id: true, email: true, name: true } },
          changedBy: { select: { id: true, email: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return { total, page, limit, items };
  }
}
```

- [ ] **Step 4: Verificar compilación**

```bash
cd /Users/sebastiansalgado/Documents/finanzas/backend && npx tsc --noEmit 2>&1; echo "exit: $?"
```

Esperado: `exit: 0`

- [ ] **Step 5: Commit**

```bash
cd /Users/sebastiansalgado/Documents/finanzas
git add backend/src/modules/admin/
git commit -m "feat(admin): add AdminGuard, DTOs and AdminService"
```

---

## Task 5: AdminController + AdminModule + registrar en AppModule

**Files:**
- Create: `backend/src/modules/admin/admin.controller.ts`
- Create: `backend/src/modules/admin/admin.module.ts`
- Modify: `backend/src/app.module.ts`

**Contexto:** Verificar los import paths de `JwtAuthGuard` y `CurrentUser` leyendo `backend/src/modules/invoices/invoices.controller.ts`. Típicamente son `'../auth/guards/jwt-auth.guard'` y `'../auth/decorators/current-user.decorator'`.

- [ ] **Step 1: Crear AdminController**

```typescript
// backend/src/modules/admin/admin.controller.ts
import { Controller, Get, Patch, Param, Body, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { ChangePlanDto } from './dto/change-plan.dto';
import { ToggleStaffDto } from './dto/toggle-staff.dto';
import { AdminGuard } from './guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private service: AdminService) {}

  @Get('stats')
  stats() {
    return this.service.getStats();
  }

  @Get('users')
  users() {
    return this.service.listUsers();
  }

  @Patch('users/:id/plan')
  changePlan(
    @CurrentUser() admin: { id: string },
    @Param('id') userId: string,
    @Body() dto: ChangePlanDto,
  ) {
    return this.service.changePlan(admin.id, userId, dto.plan, dto.note);
  }

  @Patch('users/:id/staff')
  toggleStaff(
    @CurrentUser() admin: { id: string },
    @Param('id') userId: string,
    @Body() dto: ToggleStaffDto,
  ) {
    return this.service.toggleStaff(admin.id, userId, dto.isStaff);
  }

  @Get('users/:id/history')
  userHistory(@Param('id') userId: string) {
    return this.service.getUserHistory(userId);
  }

  @Get('history')
  globalHistory(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('userId') userId?: string,
  ) {
    return this.service.getGlobalHistory(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 50,
      userId,
    );
  }
}
```

- [ ] **Step 2: Crear AdminModule**

```typescript
// backend/src/modules/admin/admin.module.ts
import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';

@Module({
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
```

- [ ] **Step 3: Registrar en AppModule**

En `backend/src/app.module.ts`, añadir:
- Import: `import { AdminModule } from './modules/admin/admin.module';`
- En el array `imports`: `AdminModule`

- [ ] **Step 4: Verificar compilación**

```bash
cd /Users/sebastiansalgado/Documents/finanzas/backend && npx tsc --noEmit 2>&1; echo "exit: $?"
```

Esperado: `exit: 0`

- [ ] **Step 5: Commit**

```bash
cd /Users/sebastiansalgado/Documents/finanzas
git add backend/src/modules/admin/ backend/src/app.module.ts
git commit -m "feat(admin): add AdminController, AdminModule and register in AppModule"
```

---

## Task 6: Frontend — página /admin

**Files:**
- Create: `frontend/src/app/(dashboard)/admin/page.tsx`

**Contexto:** La página vive dentro del layout `(dashboard)`. El hook `useAuth()` viene de `@/context/auth.context` y expone `{ user }`. El `api` de axios está en `@/lib/axios`. `useQuery` y `useMutation` de `@tanstack/react-query`. Si `user.isStaff !== true`, redirigir a `/personal`.

- [ ] **Step 1: Crear `frontend/src/app/(dashboard)/admin/page.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { useAuth } from '@/context/auth.context';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Shield, Users, TrendingUp, Gift, UserCheck, Clock } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Stats {
  totalUsers: number;
  byPlan: { FREE: number; PRO: number; EMPRESA: number };
  paidPlans: { PRO: number; EMPRESA: number };
  grantedPlans: { PRO: number; EMPRESA: number };
  mrr: number;
  mrrLost: number;
  newUsersLast30Days: number;
}

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  plan: 'FREE' | 'PRO' | 'EMPRESA';
  isStaff: boolean;
  planGrantedByAdmin: boolean;
  createdAt: string;
  _count: { businesses: number };
}

interface HistoryItem {
  id: string;
  fromPlan: string;
  toPlan: string;
  grantedByAdmin: boolean;
  note: string | null;
  createdAt: string;
  user: { id: string; email: string; name: string | null };
  changedBy: { id: string; email: string; name: string | null } | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCOP(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

const PLAN_COLORS: Record<string, string> = {
  FREE:    'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
  PRO:     'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  EMPRESA: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'users' | 'history'>('users');
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [planNote, setPlanNote] = useState<Record<string, string>>({});

  if (user && !user.isStaff) {
    router.replace('/personal');
    return null;
  }

  const { data: stats } = useQuery<Stats>({
    queryKey: ['admin', 'stats'],
    queryFn: async () => (await api.get('/admin/stats')).data,
  });

  const { data: users } = useQuery<AdminUser[]>({
    queryKey: ['admin', 'users'],
    queryFn: async () => (await api.get('/admin/users')).data,
  });

  const { data: history } = useQuery<{ total: number; items: HistoryItem[] }>({
    queryKey: ['admin', 'history'],
    queryFn: async () => (await api.get('/admin/history?limit=100')).data,
    enabled: activeTab === 'history',
  });

  const planMutation = useMutation({
    mutationFn: ({ id, plan, note }: { id: string; plan: string; note?: string }) =>
      api.patch(`/admin/users/${id}/plan`, { plan, note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
  });

  const staffMutation = useMutation({
    mutationFn: ({ id, isStaff }: { id: string; isStaff: boolean }) =>
      api.patch(`/admin/users/${id}/staff`, { isStaff }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <nav className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield size={20} className="text-blue-600 dark:text-blue-400" />
            <span className="font-bold text-gray-900 dark:text-white">Panel de administración</span>
          </div>
          <ThemeToggle />
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Users,      label: 'Total usuarios',       value: stats?.totalUsers ?? '—' },
            { icon: TrendingUp, label: 'MRR real',             value: stats ? formatCOP(stats.mrr) : '—' },
            { icon: Gift,       label: 'Planes regalados',     value: stats ? `${(stats.grantedPlans.PRO ?? 0) + (stats.grantedPlans.EMPRESA ?? 0)} usu. · ${formatCOP(stats.mrrLost)}` : '—' },
            { icon: UserCheck,  label: 'Nuevos este mes',      value: stats?.newUsersLast30Days ?? '—' },
          ].map(card => (
            <div key={card.label} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-5">
              <div className="flex items-center gap-2 mb-2">
                <card.icon size={16} className="text-gray-400 dark:text-gray-500" />
                <span className="text-xs text-gray-500 dark:text-gray-400">{card.label}</span>
              </div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{String(card.value)}</p>
            </div>
          ))}
        </div>

        {/* Plan breakdown */}
        {stats && (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-5">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Distribución de planes</h3>
            <div className="grid grid-cols-3 gap-4">
              {(['FREE', 'PRO', 'EMPRESA'] as const).map(plan => (
                <div key={plan} className="text-center">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.byPlan[plan] ?? 0}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PLAN_COLORS[plan]}`}>{plan}</span>
                  {plan !== 'FREE' && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {stats.paidPlans[plan] ?? 0} pago · {stats.grantedPlans[plan] ?? 0} regalo
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit">
          {(['users', 'history'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${activeTab === tab ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
            >
              {tab === 'users' ? 'Usuarios' : 'Historial'}
            </button>
          ))}
        </div>

        {/* Tabla de usuarios */}
        {activeTab === 'users' && (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800">
                <tr>
                  {['Usuario', 'Plan', 'Staff', 'Empresas', 'Registro', 'Acciones'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {(users ?? []).map(u => (
                  <>
                    <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 dark:text-white">{u.name ?? '—'}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">{u.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PLAN_COLORS[u.plan]}`}>{u.plan}</span>
                        {u.planGrantedByAdmin && <span className="ml-1 text-xs text-amber-500">regalo</span>}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => staffMutation.mutate({ id: u.id, isStaff: !u.isStaff })}
                          disabled={staffMutation.isPending}
                          className={`relative inline-flex w-10 h-5 rounded-full transition-colors ${u.isStaff ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                        >
                          <span className={`inline-block w-4 h-4 bg-white rounded-full shadow mt-0.5 transition-transform ${u.isStaff ? 'translate-x-5' : 'translate-x-0.5'}`} />
                        </button>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{u._count.businesses}</td>
                      <td className="px-4 py-3 text-gray-400 dark:text-gray-500 text-xs">{new Date(u.createdAt).toLocaleDateString('es-CO')}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setExpandedUserId(expandedUserId === u.id ? null : u.id)}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {expandedUserId === u.id ? 'Cerrar' : 'Cambiar plan'}
                        </button>
                      </td>
                    </tr>
                    {expandedUserId === u.id && (
                      <tr key={`${u.id}-expand`} className="bg-blue-50/40 dark:bg-blue-900/10">
                        <td colSpan={6} className="px-4 py-3">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-xs text-gray-500 dark:text-gray-400">Cambiar a:</span>
                            {(['FREE', 'PRO', 'EMPRESA'] as const).map(plan => (
                              <button
                                key={plan}
                                disabled={u.plan === plan || planMutation.isPending}
                                onClick={() => planMutation.mutate({ id: u.id, plan, note: planNote[u.id] || undefined })}
                                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition border ${u.plan === plan ? 'opacity-40 cursor-not-allowed border-gray-200 dark:border-gray-700' : 'border-blue-300 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-300'}`}
                              >
                                {plan}
                              </button>
                            ))}
                            <input
                              type="text"
                              placeholder="Nota opcional..."
                              value={planNote[u.id] ?? ''}
                              onChange={e => setPlanNote(prev => ({ ...prev, [u.id]: e.target.value }))}
                              className="text-xs px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 flex-1 min-w-[160px]"
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Historial global */}
        {activeTab === 'history' && (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
              <Clock size={15} className="text-gray-400" />
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Historial de cambios de plan</span>
              <span className="ml-auto text-xs text-gray-400">{history?.total ?? 0} entradas</span>
            </div>
            <div className="divide-y divide-gray-50 dark:divide-gray-800">
              {(history?.items ?? []).map(h => (
                <div key={h.id} className="px-4 py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{h.user.name ?? h.user.email}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{h.user.email}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`px-2 py-0.5 rounded-full font-medium ${PLAN_COLORS[h.fromPlan]}`}>{h.fromPlan}</span>
                    <span className="text-gray-400">→</span>
                    <span className={`px-2 py-0.5 rounded-full font-medium ${PLAN_COLORS[h.toPlan]}`}>{h.toPlan}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 dark:text-gray-400">{h.changedBy ? (h.changedBy.name ?? h.changedBy.email) : 'Sistema'}</p>
                    {h.note && <p className="text-xs text-gray-400 dark:text-gray-500 italic">{h.note}</p>}
                    <p className="text-xs text-gray-300 dark:text-gray-600">{new Date(h.createdAt).toLocaleString('es-CO')}</p>
                  </div>
                </div>
              ))}
              {(history?.items ?? []).length === 0 && (
                <p className="text-center py-8 text-sm text-gray-400 dark:text-gray-500">Sin cambios registrados aún</p>
              )}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
```

- [ ] **Step 2: Verificar compilación**

```bash
cd /Users/sebastiansalgado/Documents/finanzas/frontend && npx tsc --noEmit 2>&1; echo "exit: $?"
```

Esperado: `exit: 0`

- [ ] **Step 3: Commit**

```bash
cd /Users/sebastiansalgado/Documents/finanzas
git add frontend/src/app/\(dashboard\)/admin/
git commit -m "feat(admin): add /admin page with stats, user table and plan history"
```

---

## Task 7: UserMenu — link Admin condicional

**Files:**
- Modify: `frontend/src/components/ui/UserMenu.tsx`

**Contexto:** El `UserMenu` ya importa `Sparkles` y otros íconos de lucide-react. El array `menuItems` define las opciones del dropdown. La condición es `user?.isStaff === true`.

- [ ] **Step 1: Añadir ícono Shield al import**

En `frontend/src/components/ui/UserMenu.tsx`, añadir `Shield` al import de lucide-react:

```typescript
import {
  User, Settings, Lock, HelpCircle, LogOut,
  X, Check, Eye, EyeOff, Loader2, Sparkles, Shield,
} from 'lucide-react';
```

- [ ] **Step 2: Añadir item Admin al array menuItems**

Insertar como PRIMER elemento del array `menuItems` (antes de "Mi perfil"), condicionalmente:

```typescript
const menuItems = [
  ...(user?.isStaff ? [{
    icon: Shield,
    label: 'Administración',
    desc: 'Panel de admin',
    action: () => { setOpen(false); router.push('/admin'); },
  }] : []),
  {
    icon: User,
    label: 'Mi perfil',
    // ... resto sin cambios
  },
  // ... resto de items
];
```

- [ ] **Step 3: Verificar compilación**

```bash
cd /Users/sebastiansalgado/Documents/finanzas/frontend && npx tsc --noEmit 2>&1; echo "exit: $?"
```

Esperado: `exit: 0`

- [ ] **Step 4: Commit**

```bash
cd /Users/sebastiansalgado/Documents/finanzas
git add frontend/src/components/ui/UserMenu.tsx
git commit -m "feat(admin): add conditional Admin link in UserMenu for staff users"
```

---

## Task 8: Migración en producción + activar primer admin + push

**Files:** ninguno nuevo

- [ ] **Step 1: Push a GitHub (dispara Vercel automáticamente)**

```bash
cd /Users/sebastiansalgado/Documents/finanzas && git push origin main
```

- [ ] **Step 2: Aplicar migración en Railway**

En la consola de Railway (pestaña **Console** del servicio backend):

```bash
npx prisma migrate deploy
```

Esperado: `All migrations have been successfully applied.`

- [ ] **Step 3: Activar tu cuenta como primer admin**

En la consola de Railway, ejecutar:

```sql
-- Reemplaza con tu email real
UPDATE "users" SET "isStaff" = true, plan = 'EMPRESA', "planGrantedByAdmin" = false, "planStartedAt" = NOW()
WHERE email = 'tu@email.com';
```

Para ejecutar SQL en Railway: en la pestaña **Data** del servicio **Postgres** → botón **Query** → pegar el SQL y ejecutar.

- [ ] **Step 4: Verificar en producción**

Entra a la app en Vercel, inicia sesión con tu cuenta, abre el menú de usuario — debe aparecer la opción "Administración". Entra y verifica que se ven las estadísticas y la tabla de usuarios.
