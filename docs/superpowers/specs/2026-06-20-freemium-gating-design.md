# Freemium gating + equipos — Diseño técnico
**Fecha:** 2026-06-20  
**Estado:** Aprobado — pendiente implementación

---

## Contexto

Nomi es una app de finanzas personales y empresariales (NestJS + Next.js 14). Se añade un sistema de planes freemium con tres niveles y un módulo de equipo multi-usuario por empresa. El gateway de pago (Wompi) se conecta al final como un plug-in — toda la infraestructura queda lista antes.

---

## Planes y límites

| Recurso | FREE | PRO ($16.900/mes) | EMPRESA ($34.900/mes) |
|---|---|---|---|
| Empresas activas | 1 | 1 | Ilimitadas |
| Facturas / mes | 15 | Ilimitadas | Ilimitadas |
| Clientes activos | 15 | Ilimitados | Ilimitados |
| Productos activos | 10 | Ilimitados | Ilimitados |
| Cotizaciones / mes | 5 | Ilimitadas | Ilimitadas |
| Proveedores activos | 5 | Ilimitados | Ilimitados |
| Listas de precios | No | Sí | Sí |
| Usuarios adicionales | 0 | 1 | Ilimitados |

Los límites mensuales (facturas, cotizaciones) se cuentan desde el primer día del mes calendario (`createdAt >= inicio_mes`). Se resetean solos cada mes sin cron jobs.

---

## 1. Modelo de datos (Prisma)

### Cambios en `User`

```prisma
enum PlanType {
  FREE
  PRO
  EMPRESA
}

model User {
  // campos existentes sin cambios
  plan          PlanType  @default(FREE)
  planExpiresAt DateTime?   // null = FREE indefinido o admin-grant sin vencimiento
  planStartedAt DateTime?
  
  businessMembers BusinessMember[]
}
```

### Nuevo: `BusinessMember`

El propietario de la empresa se identifica únicamente por `Business.userId` — no existe una fila en `BusinessMember` para él. El enum solo cubre los roles de miembros adicionales:

```prisma
enum MemberRole {
  EDITOR   // crea, edita, elimina datos del negocio
  VIEWER   // solo lectura
}

model BusinessMember {
  id         String     @id @default(cuid())
  businessId String
  userId     String
  role       MemberRole
  title      String?    // "Contador", "Asistente" — asignado por el OWNER
  invitedAt  DateTime   @default(now())

  business   Business   @relation(fields: [businessId], references: [id], onDelete: Cascade)
  user       User       @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([businessId, userId])
}
```

### Nuevo: `BusinessInvite`

```prisma
model BusinessInvite {
  id         String     @id @default(cuid())
  businessId String
  email      String
  role       MemberRole
  title      String?
  token      String     @unique   // firmado, 72h de expiración
  expiresAt  DateTime
  usedAt     DateTime?

  business   Business   @relation(fields: [businessId], references: [id], onDelete: Cascade)
}
```

`Business.userId` continúa siendo el propietario actual (OWNER). Al transferir propiedad: se actualiza `Business.userId` al nuevo dueño y el anterior queda en `BusinessMember` con rol `EDITOR`.

---

## 2. Backend

### 2.1 `PlanModule` / `PlanService`

Módulo nuevo en `backend/src/modules/plan/`. Centraliza toda la lógica de límites. Los demás servicios lo inyectan.

**Métodos públicos:**

```typescript
// Acceso a empresa — verifica owner o BusinessMember con rol suficiente
assertBusinessAccess(userId: string, businessId: string, write?: boolean): Promise<void>

// Límites de creación
assertCanCreateInvoice(userId: string, businessId: string): Promise<void>
assertCanCreateCustomer(userId: string, businessId: string): Promise<void>
assertCanCreateProduct(userId: string, businessId: string): Promise<void>
assertCanCreateQuotation(userId: string, businessId: string): Promise<void>
assertCanCreateSupplier(userId: string, businessId: string): Promise<void>
assertCanCreateBusiness(userId: string): Promise<void>
assertCanUsePriceLists(userId: string): Promise<void>
assertCanAddMember(userId: string, businessId: string): Promise<void>

// Estado de uso para el frontend
getUsage(userId: string, businessId: string): Promise<UsageStats>
```

Cada `assert*` lanza `ForbiddenException` con un código de error específico en el campo `message`.

**Códigos de error:**

| Código | Método | Descripción |
|---|---|---|
| `INVOICE_LIMIT_REACHED` | `assertCanCreateInvoice` | 15 facturas/mes en FREE |
| `CLIENT_LIMIT_REACHED` | `assertCanCreateCustomer` | 15 clientes en FREE |
| `PRODUCT_LIMIT_REACHED` | `assertCanCreateProduct` | 10 productos en FREE |
| `QUOTE_LIMIT_REACHED` | `assertCanCreateQuotation` | 5 cotizaciones/mes en FREE |
| `SUPPLIER_LIMIT_REACHED` | `assertCanCreateSupplier` | 5 proveedores en FREE |
| `BUSINESS_LIMIT_REACHED` | `assertCanCreateBusiness` | 1 empresa en FREE/PRO |
| `MEMBER_LIMIT_REACHED` | `assertCanAddMember` | 0 miembros en FREE, 1 en PRO |
| `FEATURE_NOT_AVAILABLE` | `assertCanUsePriceLists` | Listas de precios solo PRO/EMPRESA |
| `NOT_A_MEMBER` | `assertBusinessAccess` | Usuario sin acceso a la empresa |
| `VIEWER_CANNOT_WRITE` | `assertBusinessAccess(write=true)` | VIEWER intentando escribir |

**Patrón de uso en servicios existentes:**

```typescript
// invoices.service.ts — dos líneas al inicio de create()
async create(userId: string, businessId: string, dto: CreateInvoiceDto) {
  await this.planService.assertBusinessAccess(userId, businessId, true);
  await this.planService.assertCanCreateInvoice(userId, businessId);
  // ...código existente sin cambios
}
```

Se aplica el mismo patrón en: `InvoicesService`, `CustomersService`, `ProductsService`, `QuotationsService`, `SuppliersService`, `BusinessesService`, `PriceListsService`.

### 2.2 Endpoint de uso

```
GET /businesses/:id/usage
```

Responde con `UsageStats`:

```typescript
interface UsageStats {
  plan: 'FREE' | 'PRO' | 'EMPRESA';
  planExpiresAt: string | null;
  invoicesThisMonth: number;   invoiceLimit: number | null;   // null = ilimitado
  customersCount: number;      customerLimit: number | null;
  productsCount: number;       productLimit: number | null;
  quotesThisMonth: number;     quoteLimit: number | null;
  suppliersCount: number;      supplierLimit: number | null;
  membersCount: number;        memberLimit: number | null;
  canUsePriceLists: boolean;
  canAddBusiness: boolean;
}
```

### 2.3 `BusinessMembersModule`

Endpoints nuevos bajo `/businesses/:id/`:

```
POST   /businesses/:id/members/invite       → invita por email (OWNER only)
GET    /businesses/:id/members              → lista miembros + invitaciones pendientes
PATCH  /businesses/:id/members/:userId      → actualiza rol o título (OWNER only)
DELETE /businesses/:id/members/:userId      → expulsa miembro (OWNER only)
POST   /businesses/:id/members/transfer     → transfiere propiedad (OWNER only)
GET    /invites/:token                      → valida token antes de aceptar
POST   /invites/:token/accept               → acepta invitación (crea BusinessMember)
```

Flujo de invitación:
1. OWNER envía `{ email, role, title }` a `POST /members/invite`
2. Backend busca si el email ya tiene cuenta:
   - Sí → crea `BusinessMember` directamente, envía email de notificación
   - No → crea `BusinessInvite` con token, envía email con link de registro + aceptación automática
3. El token del link lleva a `/invites/[token]` en el frontend — muestra resumen de la invitación y botón de aceptar
4. `POST /invites/:token/accept` valida expiración, crea `BusinessMember`, marca `usedAt`

### 2.4 `SubscriptionsModule` (Wompi — stub)

```
POST /subscriptions/checkout          → crea sesión de pago y devuelve URL de Wompi
POST /subscriptions/webhook           → recibe eventos de Wompi (HMAC verificado)
GET  /subscriptions/status            → estado actual del plan del usuario autenticado
```

`POST /subscriptions/checkout` acepta `{ plan: 'PRO' | 'EMPRESA' }`. Cuando `WOMPI_PRIVATE_KEY` está vacía, devuelve `{ status: 'GATEWAY_PENDING' }`. Cuando está configurada, llama a la API de Wompi y devuelve `{ url: string }`.

`POST /subscriptions/webhook` verifica la firma con `WOMPI_EVENTS_SECRET`, luego:
- Evento `transaction.updated` con status `APPROVED` → actualiza `User.plan` y `planExpiresAt = now + 30 días`
- Evento de rechazo → no modifica el plan

Variables de entorno necesarias en Railway:
```
WOMPI_PUBLIC_KEY=
WOMPI_PRIVATE_KEY=
WOMPI_EVENTS_SECRET=
```

---

## 3. Frontend

### 3.1 Árbol de providers

```
/empresas/[id]/layout.tsx
  └── PlanProvider          (fetch /usage, expone contexto)
        └── UpgradeModalProvider   (gestiona modal global)
              └── páginas del negocio
```

### 3.2 `PlanContext` / `usePlan()`

```typescript
interface PlanContextValue {
  plan: 'FREE' | 'PRO' | 'EMPRESA';
  usage: UsageStats | null;
  isLoading: boolean;
  refetch: () => void;
}

// Uso en cualquier componente:
const { plan, usage } = usePlan();
```

`PlanProvider` hace un `useQuery` a `/businesses/:id/usage`. Las mutations que crean recursos invalidan `['usage', businessId]` en `onSuccess`.

### 3.3 Interceptor Axios — trigger automático del modal

```typescript
// src/lib/axios.ts — añadir al interceptor de respuesta existente
const UPGRADE_ERRORS = [
  'INVOICE_LIMIT_REACHED', 'CLIENT_LIMIT_REACHED', 'PRODUCT_LIMIT_REACHED',
  'QUOTE_LIMIT_REACHED', 'SUPPLIER_LIMIT_REACHED', 'BUSINESS_LIMIT_REACHED',
  'MEMBER_LIMIT_REACHED', 'FEATURE_NOT_AVAILABLE',
];

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const code = error.response?.data?.message;
    if (UPGRADE_ERRORS.includes(code)) {
      upgradeModalBus.emit(code);
    }
    return Promise.reject(error);
  }
);
```

`upgradeModalBus` es un EventEmitter mínimo desacoplado del árbol React (evita dependencia del contexto dentro del interceptor).

### 3.4 `UpgradeModal`

Modal global montado en el layout. Escucha el bus y muestra el mensaje correcto:

```typescript
const UPGRADE_MESSAGES = {
  INVOICE_LIMIT_REACHED:  { title: 'Alcanzaste el límite de facturas',   body: 'PRO incluye facturas ilimitadas.',              targetPlan: 'PRO'     },
  CLIENT_LIMIT_REACHED:   { title: 'Alcanzaste el límite de clientes',    body: 'PRO incluye clientes ilimitados.',              targetPlan: 'PRO'     },
  PRODUCT_LIMIT_REACHED:  { title: 'Alcanzaste el límite de productos',   body: 'PRO incluye catálogo ilimitado.',               targetPlan: 'PRO'     },
  QUOTE_LIMIT_REACHED:    { title: 'Alcanzaste el límite de cotizaciones', body: 'PRO incluye cotizaciones ilimitadas.',         targetPlan: 'PRO'     },
  SUPPLIER_LIMIT_REACHED: { title: 'Alcanzaste el límite de proveedores', body: 'PRO incluye proveedores ilimitados.',           targetPlan: 'PRO'     },
  BUSINESS_LIMIT_REACHED: { title: 'Solo una empresa por plan',           body: 'Empresa incluye negocios ilimitados.',          targetPlan: 'EMPRESA' },
  MEMBER_LIMIT_REACHED:   { title: 'Límite de usuarios del equipo',       body: 'Empresa incluye usuarios ilimitados.',          targetPlan: 'EMPRESA' },
  FEATURE_NOT_AVAILABLE:  { title: 'Listas de precios — función PRO',     body: 'Crea precios diferenciados con Nomi PRO.',      targetPlan: 'PRO'     },
};
```

Acciones: **"Ver planes"** → navega a `/planes` · **"Más tarde"** → cierra.

### 3.5 Barras de uso (solo FREE)

Card visible en `/empresas/[id]` para usuarios FREE. Para PRO/EMPRESA muestra badge "Plan PRO activo ✓".

- Barra ámbar al ≥ 80% del límite
- Barra roja al 100% (límite alcanzado)
- Botón "Actualizar a Nomi PRO — $16.900/mes" → `/planes`

### 3.6 `PlanGate` — features binarias

Para Listas de precios (FREE no accede en absoluto):

```tsx
<PlanGate requiredPlan="PRO">
  <PriceListsContent />
</PlanGate>
```

Si `plan < requiredPlan`, renderiza overlay con ícono de candado + descripción de la feature + botón "Ver planes".

### 3.7 Página `/equipos` — gestión de miembros

Nueva ruta: `/empresas/[id]/equipo`

Secciones:
1. **Miembros activos** — nombre, email, título, badge de rol, botones editar/expulsar (solo OWNER)
2. **Formulario de invitación** — email + selector EDITOR/VIEWER + campo título (visible si plan permite más miembros)
3. **Invitaciones pendientes** — email, rol, botón cancelar
4. **Transferir propiedad** — botón de peligro al final, abre `ConfirmDialog` con aviso completo:

> *"Vas a transferir la propiedad de [Empresa] a [Nombre]. Perderás la capacidad de invitar miembros, eliminar la empresa y cambiar configuraciones. Pasarás a ser Editor. Esta acción no se puede deshacer sin que el nuevo propietario te la devuelva."*

EDITOR y VIEWER ven la lista en modo lectura sin controles.

---

## 4. Página `/planes`

Ruta dentro de `(dashboard)`. Accesible desde: `UpgradeModal`, card de uso, menú de perfil.

### Estructura

```
Encabezado — "Elige tu plan"
3 cards de precio (FREE · PRO · EMPRESA)
Tabla comparativa detallada (desplegable)
```

### CTA

```tsx
// checkout/page.tsx
async function startCheckout(plan: 'PRO' | 'EMPRESA') {
  const { data } = await api.post('/subscriptions/checkout', { plan });
  if (data.status === 'GATEWAY_PENDING') {
    // Wompi no configurado aún — mostrar "Próximamente"
    return;
  }
  window.location.href = data.url;  // redirige a checkout de Wompi
}
```

El botón dice "Próximamente" mientras `WOMPI_PUBLIC_KEY` está vacía en Railway. Cuando las credenciales estén configuradas, el flujo completo se activa sin tocar código de frontend.

### Flujo de retorno

- Wompi redirige a `/planes?status=success` → mostrar toast "¡Plan activado!" e invalidar query de usuario
- `/planes?status=error` → toast de error con opción de reintentar

---

## 5. Plan del JWT

El campo `plan` se incluye en el payload del JWT al hacer login/refresh. Si un admin actualiza el plan manualmente en DB, el usuario necesita cerrar y volver a abrir sesión. Al conectar Wompi, el webhook actualiza el plan en DB y el frontend hace refresh del token automáticamente tras la redirección de éxito.

---

## Variables de entorno necesarias

**Railway (backend):**
```
WOMPI_PUBLIC_KEY=
WOMPI_PRIVATE_KEY=
WOMPI_EVENTS_SECRET=
```

**Vercel (frontend):**
```
NEXT_PUBLIC_WOMPI_PUBLIC_KEY=
```

---

## Archivos nuevos

```
backend/src/modules/plan/
  plan.service.ts
  plan.module.ts

backend/src/modules/business-members/
  business-members.controller.ts
  business-members.service.ts
  business-members.module.ts
  dto/invite-member.dto.ts
  dto/update-member.dto.ts

backend/src/modules/subscriptions/
  subscriptions.controller.ts
  subscriptions.service.ts
  subscriptions.module.ts

frontend/src/context/
  PlanContext.tsx
  UpgradeModalContext.tsx

frontend/src/lib/
  upgradeModalBus.ts

frontend/src/components/ui/
  UpgradeModal.tsx
  PlanGate.tsx
  UsageCard.tsx

frontend/src/app/(dashboard)/
  planes/page.tsx
  checkout/page.tsx
  empresas/[id]/equipo/page.tsx
```

## Archivos modificados

```
backend/src/modules/invoices/invoices.service.ts
backend/src/modules/invoices/invoices.module.ts
backend/src/modules/customers/customers.service.ts
backend/src/modules/customers/customers.module.ts
backend/src/modules/products/products.service.ts
backend/src/modules/products/products.module.ts
backend/src/modules/quotes/quotes.service.ts
backend/src/modules/suppliers/suppliers.service.ts
backend/src/modules/businesses/businesses.service.ts
backend/src/modules/price-lists/price-lists.service.ts
backend/src/modules/auth/auth.service.ts  (añadir plan al JWT)
backend/prisma/schema.prisma              (migración)

frontend/src/lib/axios.ts                 (interceptor de upgrade)
frontend/src/app/(dashboard)/empresas/[id]/layout.tsx  (PlanProvider)
frontend/src/app/(dashboard)/empresas/[id]/page.tsx    (UsageCard)
frontend/src/app/(dashboard)/empresas/[id]/listas-precios/page.tsx  (PlanGate)

---

## Fases de implementación

El trabajo se divide en tres fases independientes. Cada fase es funcional por sí sola.

### Fase 1 — Límites de plan (sin equipo, sin pagos)
Prisma migration (`plan`, `planExpiresAt`, `planStartedAt` en User) · `PlanModule` + `PlanService` · endpoint `/usage` · enforce en los 7 servicios existentes · JWT incluye `plan` · `PlanProvider` + `usePlan()` · interceptor Axios · `UpgradeModal` · barras de uso en dashboard · `PlanGate` en listas de precios · página `/planes` (botón "Próximamente" hasta Fase 3).

### Fase 2 — Equipo multi-usuario
Prisma migration (`BusinessMember`, `BusinessInvite`) · `BusinessMembersModule` (7 endpoints) · `assertBusinessAccess` en `PlanService` · emails de invitación vía Resend · página `/empresas/[id]/equipo` · `ConfirmDialog` de transferencia de propiedad.

### Fase 3 — Wompi (cuando Sebastian avise que tiene el RUT)
`SubscriptionsModule` (checkout + webhook) · configurar variables de entorno en Railway y Vercel · página `/checkout` activa · botones en `/planes` activos · webhook actualiza plan en DB y hace refresh del JWT.
```
