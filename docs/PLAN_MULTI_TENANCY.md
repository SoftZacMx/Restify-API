# Plan de implementación — Multi-tenancy (SaaS)

Documento único del rollout multi-tenant: **5 etapas**, cada una con **fases** y **tareas** con checklists y ejemplos de código.

---

## Contexto

Restify pasa de single-tenant a SaaS con dos niveles de datos:

- **Organización** — cuenta del cliente (billing, dueño, usuarios).
- **Sucursal** — local físico donde corre el POS (menú, órdenes, mesas). Ver [Etapa 2](#etapa-2--sucursales-branches).

Estrategia: **shared database** + aislamiento lógico con `TenantContext` y extensión Prisma (`organizationId` / `branchId`).

### Alcance de despliegue

- **Prod actual (legacy):** no se toca; sigue single-tenant.
- **Deploy nuevo:** DB vacía, clientes nuevos multi-tenant desde día 1.
- **Rama:** `feature/multi-tenancy` → target del deploy nuevo.

### Modelo de cuentas (resumen)

- Solo el **owner** se registra en público.
- 1 user = 1 org; el owner crea el resto de usuarios.
- Límite de **sucursales** por plan (detalle en Etapa 2).

---

## Índice de etapas

| Etapa | Nombre | Sección |
|-------|--------|---------|
| **1** | Multi-tenancy núcleo | [Etapa 1](#etapa-1--multi-tenancy-núcleo) |
| **2** | Sucursales (branches) | [Etapa 2](#etapa-2--sucursales-branches) |
| **3** | Adaptar Restify actual | [Etapa 3](#etapa-3--adaptar-restify-actual) |
| **3.5** | Aislar stock y recetas (merge `qa`) | [Etapa 3.5](#etapa-35--aislar-stock-y-recetas-merge-qa) |
| **4** | Producto SaaS (org) | [Etapa 4](#etapa-4--producto-saas) |
| **5** | Go-live | [Etapa 5](#etapa-5--go-live) |

**Estimación total:** ~3 semanas (15 días laborables, 1 dev concentrado).

---

## Orden de ejecución (consolidado)

Implementar en este orden:

| Paso | Qué | Estado | Duración restante |
|------|-----|--------|-------------------|
| 1 | **Schema completo**: Org + Users + Branches + `branchId` + índices | ✅ 95% | 0.5 días (índices) |
| 2 | **Infraestructura tenant**: TenantContext + Prisma Extension + middleware | ✅ Completo | 0 días |
| 3 | **Auth multi-tenant**: JWT con org/branch + roles + switch-branch | ✅ Completo | 0 días |
| 4 | **API Sucursales**: CRUD + acceso user↔sucursal + límites plan | ✅ Completo | 0 días |
| 5 | **Adaptar POS**: Repos (orders, menu, payments, tables) + webhooks | ✅ ~95% | 0 días (smoke test) |
| 6 | **Aislar stock y recetas** (merge `qa`): `branchId` + extension + servicios | ✅ Completo | 0 días |
| 7 | **Signup público**: Org + primera sucursal + bootstrap + email verification | ⏳ Pendiente | 1 día |
| 8 | **Frontend**: Selector sucursal + CRUD + onboarding + reemplazo Company | ⏳ Pendiente | 3 días |
| 9 | **QA + Rollout**: Tests E2E + aislamiento + deploy | ⏳ Pendiente | 2 días |

**Progreso:** 6/9 pasos completos (~67%)  
**Total restante:** ~6 días

---

## Etapa 1 — Multi-tenancy núcleo

**Objetivo:** organización, aislamiento en código y autenticación con `org` (y claim `branch` en JWT, sin UI de sucursales).

### Fase 1.1 — Schema organización y usuarios

**Tareas:**

- [x] Crear modelo `Organization` y enum `OrganizationPlan`, `OrganizationStatus`.
- [x] Modificar `User`: `organizationId`, `role` (`owner` | `admin` | `manager` | `waiter` | `chef`), `accountStatus`, `mustChangePassword`, `emailVerifiedAt`, `tokenVersion`.
- [x] Enum `UserAccountStatus` (`ACTIVE`, `DISABLED`).
- [x] Migración SQL con organización legacy para usuarios existentes.
- [x] Índices de performance multi-tenant agregados.
- [x] `prisma validate` (schema validado).
- [ ] Aplicar migración: `prisma migrate deploy`.
- [ ] Tabla `subscriptions` 1:1 con org; catálogo `subscription_plans` con `max_branches` (consumido en Etapa 2).
- [ ] Seed plan **Free Legacy** (`max_branches = 3`).

**Ejemplo Prisma — Organization:**

```prisma
enum OrganizationPlan {
  FREE
  PRO
  ENTERPRISE
}

enum OrganizationStatus {
  ACTIVE
  SUSPENDED
  CANCELLED
}

model Organization {
  id        String             @id @default(uuid())
  name      String
  slug      String?            @unique
  plan      OrganizationPlan   @default(FREE)
  status    OrganizationStatus @default(ACTIVE)
  createdAt DateTime           @default(now())
  updatedAt DateTime           @updatedAt
  deletedAt DateTime?

  users         User[]
  subscriptions Subscription[]

  @@map("organizations")
}
```

**Ejemplo Prisma — campos nuevos en User:**

```prisma
enum OrganizationRole {
  owner
  admin
  manager
  waiter
  chef
}

enum UserAccountStatus {
  active
  disabled
}

model User {
  // ... campos existentes ...
  organizationId      String
  role                OrganizationRole
  accountStatus       UserAccountStatus @default(active)
  mustChangePassword  Boolean           @default(false)
  emailVerifiedAt     DateTime?
  tokenVersion        Int               @default(0)

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([organizationId, role])
  @@index([organizationId, accountStatus])
}
```

**Salida:** 
- Migración `organizations` + `users` con campos multi-tenant
- Índices de performance para queries multi-tenant
- Organización "Legacy" automática para usuarios existentes
- Sin tablas `branches` (Etapa 2)
- Sin tablas de tokens separadas (campos en User son suficientes)

---

### Fase 1.2 — Aislamiento (Tenant Context)

**Tareas:**

- [x] `src/core/infrastructure/tenant/tenant-context.ts` con `AsyncLocalStorage`.
- [x] Middleware HTTP: `TenantMiddleware.attach` leer JWT → `runWithTenant({ organizationId, branchId? })`.
- [x] `src/core/infrastructure/database/prisma/tenant-extension.ts` — filtro org-level y branch-level.
- [x] `withoutTenant(fn)` para signup, crons cross-tenant, scripts admin.
- [x] `getPrisma()` único punto de acceso al cliente extendido.
- [x] Aplicar middleware tenant globalmente en `routes/index.ts`.
- [x] Tests en `tests/integration/tenant-isolation.test.ts`.

**Ejemplo — TenantContext:**

```typescript
// src/core/infrastructure/tenant/tenant-context.ts
import { AsyncLocalStorage } from 'async_hooks';

type TenantStore = {
  organizationId: string;
  branchId?: string;
};

const storage = new AsyncLocalStorage<TenantStore>();

export function runWithTenant<T>(
  ctx: TenantStore,
  fn: () => T | Promise<T>
): T | Promise<T> {
  return storage.run(ctx, fn);
}

export function requireOrganizationId(): string {
  const orgId = storage.getStore()?.organizationId;
  if (!orgId) throw new Error('TENANT_ORG_REQUIRED');
  return orgId;
}

export function requireBranchId(): string {
  const branchId = storage.getStore()?.branchId;
  if (!branchId) throw new Error('TENANT_BRANCH_REQUIRED');
  return branchId;
}

export async function withoutTenant<T>(fn: () => Promise<T>): Promise<T> {
  return storage.run(undefined as unknown as TenantStore, fn);
}
```

**Ejemplo — middleware Express:**

```typescript
// Pseudocódigo: después de authMiddleware
app.use((req, res, next) => {
  const payload = req.user; // JwtPayload
  if (!payload?.org) return next();

  return runWithTenant(
    { organizationId: payload.org, branchId: payload.branch ?? undefined },
    () => next()
  );
});
```

**Reglas Prisma extension:**

| Nivel | Modelos | Filtro / create |
|-------|---------|-----------------|
| Global | `subscription_plans` | Sin filtro |
| Org | `users`, `subscriptions` | `organizationId` |
| Branch | `orders`, `menu_items`, … | `branchId` — inventario en Etapa 2 |

Sin contexto en modelo de dominio → **error**, no query silenciosa.

**Salida:** tenant operativo; POS aún se adapta en Etapa 3.

---

### Fase 1.3 — Auth, permisos y JWT

**Tareas:**

- [x] Payload JWT con `sub`, `org`, `branch` (nullable), `rol`, `tokenVersion`, `emailVerified`, `mustChangePassword`.
- [x] Login: validar user/org activos; emitir JWT 8h con nuevo payload.
- [x] `POST /auth/switch-branch` — validar acceso (usa `UserBranchAccess`).
- [x] `requireRole` / `requireAnyRole` (existe `AuthMiddleware.authorize`).
- [x] Middleware: validar org/user activos + `tokenVersion` (`AuthMiddleware.validateTokenAndStatus`).
- [x] `GET /api/config` público (retorna `billingEnabled`, `environment`, `apiVersion`).
- [x] Tests auth/JWT (`tests/integration/auth-multi-tenant.test.ts`).
- [ ] Password policy, change-password (usa campos `mustChangePassword`, `emailVerifiedAt` en User) - Pendiente para futuro.
- [ ] `subscriptionGuard` con `BILLING_ENABLED=false` por defecto - Ya existe `SubscriptionMiddleware` (no requiere cambios).

**Ejemplo — JWT payload:**

```json
{
  "sub": "user-uuid",
  "org": "org-uuid",
  "branch": "branch-uuid-or-null",
  "role": "owner",
  "subscriptionStatus": "FREE",
  "tokenVersion": 0,
  "emailVerified": false,
  "mustChangePassword": false,
  "exp": 1735689600
}
```

**Ejemplo — emitir token:**

```typescript
// Validar secret explícitamente
const secret = process.env.JWT_SECRET;
if (!secret) {
  throw new Error('JWT_SECRET environment variable is required');
}

const token = jwt.sign(
  {
    sub: user.id,
    org: user.organizationId,
    branch: initialBranchId ?? null,
    role: user.role,
    subscriptionStatus: subscription.status,
    tokenVersion: user.tokenVersion,
    emailVerified: user.emailVerifiedAt != null,
    mustChangePassword: user.mustChangePassword,
  },
  secret,
  { expiresIn: '8h' }
);
```

**Ejemplo — switch-branch (contrato):**

```typescript
// POST /auth/switch-branch
// Body: { "branchId": "uuid" }
// Response 200: { "token": "..." }

// Validación: usar getAccessibleBranchIds(user) de Etapa 2.3
// branch disabled o otra org → 403 / 404
```

**Nivel org vs sucursal (rutas):**

- **Solo `org` en JWT:** gestión org, usuarios, listado sucursales (Etapa 2).
- **Requiere `branch` en JWT:** POS (órdenes, menú, mesas, pagos). Sin branch → `400 branch_required`.

**Salida:** auth multi-tenant; sucursales CRUD/UI en Etapa 2.

#### Checklist Fase 1.3

- [ ] Login emite shape JWT correcto.
- [ ] `tokenVersion` desincronizado → 401.
- [ ] `BILLING_ENABLED=false` → guard no bloquea.
- [ ] `GET /api/config` devuelve `billingEnabled` desde env.

---

## Etapa 2 — Sucursales (branches)

**Objetivo:** CRUD de sucursales, acceso user↔sucursal, UI, reemplazo de `Company`, bootstrap en signup.  
**Depende de:** Etapa 1.1 (org/users) antes de 2.1; Etapa 1.2–1.3 antes de 2.2–2.3.  
**Progreso:** ✅ Backend 100% completo (Fases 2.1-2.4) | ⏳ Frontend + deprecación Company pendientes  
**Estimación restante:** 3.75–5.75 días (de 7–9 días originales).

---

### 📊 Estado actual (2026-05-24)

**✅ Completado:**
- Schema `Branch` + `UserBranchAccess` (migración aplicada)
- CRUD API `/api/branches` con validación de límites por plan
- Login asigna `branch` inicial según rol del usuario
- Switch-branch valida permisos y emite nuevo JWT
- Repositorios y entidades implementados
- **Servicios de bootstrap:** `CreateFirstBranchUseCase` + `BootstrapBranchService` con tests

**⏳ Pendiente:**
- Índices de performance en DB + tests unitarios (2.1)
- Helper `getAccessibleBranchIds()` extraído (refactoring 2.3)
- Integrar servicios bootstrap en signup público (4.1)
- Frontend completo: selector + pantalla CRUD (2.5)
- Deprecar módulo `Company` (2.6)
- Tests E2E del módulo (2.7)

---

### Contexto de producto

- Cada **sucursal** tiene su propio menú, mesas, órdenes, pagos, tickets y credenciales MP.
- Una org puede tener **N sucursales** (plan Free Legacy: `max_branches = 3`).
- `companies` (singleton) se reemplaza por filas en `branches`.

| Rol | Sucursales |
|-----|------------|
| `owner` | Todas; CRUD sucursales |
| `admin` | Todas; operar y switch (sin CRUD) |
| `manager`, `waiter`, `chef` | Solo `user_branch_access` |
| Signup público | Crea la primera sucursal |

| Fase | Nombre | Estado | Estimación restante |
|------|--------|--------|---------------------|
| 2.1 | Dominio y persistencia | ✅ 95% | 0.5 día (índices + tests) |
| 2.2 | API REST | ✅ Completa | 0 días |
| 2.3 | Acceso user ↔ sucursal | ✅ Funcionalmente completa | 0.25 día (refactoring + tests) |
| 2.4 | Signup / bootstrap | ✅ Completa | 0 días (listo para integrar en 4.1) |
| 2.5 | Frontend sucursales | ⏳ Pendiente | 2–3 días |
| 2.6 | Migración `Company` → `Branch` | ⏳ Pendiente | 1 día |
| 2.7 | Tests del módulo | ⏳ Pendiente | 1 día |

---

### Fase 2.1 — Dominio y persistencia

**Estado: ✅ 95% COMPLETA** — Schema, repositorios y migración aplicados. Falta optimización (índices) y tests.

**Tareas:**

- [x] Modelo Prisma `Branch` + `UserBranchAccess`
- [x] `branchId` en tablas operativas
- [x] Entidades y repositorios (`IBranchRepository`, `IUserBranchAccessRepository`)
- [x] Migración `20260519013000_add_branches_b1` aplicada
- [ ] Agregar índices compuestos para queries multi-tenant (ver sección "Índices de performance")
- [ ] Tests unitarios de mapeo Prisma → entidad

**Ejemplo Prisma — Branch:**

```prisma
enum BranchStatus {
  ACTIVE
  DISABLED
}

model Branch {
  id               String       @id @default(uuid())
  organizationId   String
  name             String
  state            String
  city             String
  street           String
  exteriorNumber   String
  phone            String
  rfc              String?
  logoUrl          String?
  startOperations  String?
  endOperations    String?
  ticketConfig     Json?
  paymentConfig    String?      @db.Text
  timezone         String       @default("America/Mexico_City")
  currency         String       @default("MXN")
  status           BranchStatus @default(ACTIVE)
  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt
  deletedAt        DateTime?

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([organizationId, status])
  @@map("branches")
}
```

**Ejemplo Prisma — UserBranchAccess:**

```prisma
model UserBranchAccess {
  userId    String
  branchId  String
  createdAt DateTime @default(now())

  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  branch Branch @relation(fields: [branchId], references: [id], onDelete: Cascade)

  @@id([userId, branchId])
  @@index([branchId])
  @@map("user_branch_access")
}
```

**Inventario `branchId` (nivel sucursal):**  
`orders`, `order_items`, `order_item_extras`, `payments`, `payment_sessions`, `payment_differentiation`, `tables`, `menu_categories`, `menu_items`, `expenses`, `expense_items`, `refunds`, `employee_salary_payments`, `products`.

**Unique mesas por sucursal:** `@@unique([branchId, name])` en `tables` (cada local puede tener su "Mesa 1").

**ON DELETE (resumen):**

- `branches` → menú/mesas/productos/gastos: **CASCADE**
- `branches` → orders/payments: **SET NULL** (histórico conservado)

**Índices de performance (multi-tenant):**

```prisma
model Order {
  // Nota: id ya tiene índice automático (PRIMARY KEY)
  @@index([branchId, date])              // Reportes por fecha
  @@index([branchId, status, date])      // Órdenes pendientes
  @@index([branchId, userId])            // Órdenes por mesero
}

model Table {
  @@index([branchId])                    // Listar mesas
  @@index([branchId, availabilityStatus]) // Mesas disponibles
}

model MenuCategory {
  @@index([branchId, status])            // Categorías activas
}

model MenuItem {
  @@index([branchId, categoryId])        // Items por categoría
  @@index([branchId, status])            // Items disponibles
}

model Payment {
  @@index([branchId, createdAt])         // Reportes de pago
  @@index([orderId])                     // Buscar por orden
}

model Product {
  @@index([branchId, status])            // Inventario activo
}
```

**Archivos:**

```text
src/core/domain/entities/branch.entity.ts
src/core/domain/entities/user-branch-access.entity.ts
src/core/domain/interfaces/branch-repository.interface.ts
src/core/domain/interfaces/user-branch-access-repository.interface.ts
src/core/infrastructure/database/repositories/branch.repository.ts
src/core/infrastructure/database/repositories/user-branch-access.repository.ts
src/core/infrastructure/config/dependency-injection/branch.module.ts
```

**Salida:** ✅ Schema + repos + migración aplicados. Falta: índices de performance y tests unitarios.

---

### Fase 2.2 — API REST sucursales

**Estado: ✅ COMPLETA** — CRUD operativo con permisos y validación de límite de plan.

**Tareas:**

- [x] `GET /api/branches`, `GET /api/branches/:id`
- [x] `POST /api/branches` (owner, límite plan FREE=3)
- [x] `PATCH /api/branches/:id`, `POST .../disable`, `POST .../enable`
- [x] DTO Zod (basado en `company.dto.ts` legacy)
- [x] Controllers, use cases, rutas tras `auth` + `tenant`
- [x] Tests unitarios + integración (409 `BRANCH_LIMIT_REACHED`)

**Prefijo:** `/api/branches` — no enviar `organizationId` en body (viene del JWT/contexto).

```typescript
interface BranchListItem {
  id: string;
  name: string;
  city: string;
  state: string;
  status: 'active' | 'disabled';
  assignedUsersCount?: number;
  lastOrderAt?: string | null;
}

interface CreateBranchRequest {
  name: string;
  state: string;
  city: string;
  street: string;
  exteriorNumber: string;
  phone: string;
  rfc?: string | null;
  startOperations?: string | null;
  endOperations?: string | null;
  timezone: string;
  currency?: string;
  ticketConfig?: Record<string, unknown> | null;
  paymentConfig?: string | null;
}

interface BranchDetailResponse extends CreateBranchRequest {
  id: string;
  organizationId: string;
  logoUrl: string | null;
  status: 'active' | 'disabled';
  hasPaymentConfig: boolean;
  createdAt: string;
  updatedAt: string;
}
```

**Lógica `POST /api/branches`:**

1. `requireRole('owner')`
2. `countActiveBranches(org) >= plan.max_branches` → `409 branch_limit_reached`
3. `branchRepository.create({ ...data, organizationId })`
4. Opcional: bootstrap categorías + Mesa 1

| HTTP | Clave | Cuándo |
|------|-------|--------|
| 403 | `forbidden` | Sin permiso |
| 404 | `branch_not_found` | Otra org |
| 409 | `branch_limit_reached` | Límite plan |
| 400 | `branch_required` | POS sin branch en JWT |

**Archivos API:**

```text
src/core/application/dto/branch.dto.ts
src/core/application/use-cases/branches/*.use-case.ts
src/controllers/branches/
src/server/routes/branch.routes.ts
```

**Salida:** ✅ CRUD sucursales operativo con validación de límites por plan.

---

### Fase 2.3 — Acceso user ↔ sucursal

**Estado: ✅ FUNCIONALMENTE COMPLETA** — La lógica está implementada en `login.use-case.ts` (líneas 81-111) y `switch-branch.use-case.ts` (líneas 85-94). Solo falta refactoring menor.

**Tareas:**

- [x] Lógica de acceso por rol implementada en login (owner/admin: todas; otros: `user_branch_access`)
- [x] JWT inicial incluye `branch` según permisos del usuario
- [x] `POST /auth/switch-branch` valida acceso y emite nuevo JWT
- [ ] Extraer helper `getAccessibleBranchIds(user)` reutilizable (actualmente inline en login)
- [ ] `branchIds` en `POST/PATCH /api/users` (Etapa 4.1)
- [ ] Tests específicos de acceso + switch-branch

```typescript
export async function getAccessibleBranchIds(user: User): Promise<string[]> {
  if (user.role === 'owner' || user.role === 'admin') {
    return branchRepository.findAllIdsByOrganizationId(user.organizationId);
  }
  return userBranchAccessRepository.findBranchIdsByUserId(user.id);
}

// POST /auth/switch-branch — implementación (Etapa 1.3 llama aquí)
export async function switchBranch(user: User, branchId: string): Promise<string> {
  const allowed = await getAccessibleBranchIds(user);
  if (!allowed.includes(branchId)) throw new AppError('BRANCH_FORBIDDEN', 403);
  const branch = await branchRepository.findById(branchId);
  if (!branch?.isActive()) throw new AppError('BRANCH_DISABLED', 403);
  return jwtService.sign({ ...user, branch: branchId });
}
```

**Reglas `switch-branch`:**

- Owner/admin: cualquier sucursal `active` de su org
- Otros: solo `user_branch_access`
- Sucursal de otra org → `404` (no filtrar existencia)

**Salida:** ✅ login y switch respetan asignación. **Implementado en:**
- `login.use-case.ts` líneas 81-111 (determina sucursales accesibles)
- `switch-branch.use-case.ts` líneas 85-94 (valida acceso antes de emitir JWT)

---

### Fase 2.4 — Signup y bootstrap primera sucursal

**Estado: ✅ COMPLETA** — Servicios de bootstrap implementados y testeados. Listos para integrarse en **Etapa 4.1 (Signup público)**.

**Tareas:**

- [x] Servicio `CreateFirstBranchUseCase` — crea primera branch sin validar límites (para signup)
- [x] Servicio `BootstrapBranchService` — crea 4 categorías menú + Mesa 1
- [x] Tests unitarios de ambos servicios
- [x] Test de integración demostrando flujo completo en transacción
- [x] Servicios registrados en DI container
- [ ] Signup (Etapa 4.1) integra estos servicios y emite JWT inicial con `branch`

**Implementado en:**
- `src/core/application/use-cases/branches/create-first-branch.use-case.ts`
- `src/core/application/services/bootstrap-branch.service.ts`
- `tests/unit/use-cases/branches/create-first-branch.use-case.test.ts`
- `tests/unit/services/bootstrap-branch.service.test.ts`
- `tests/integration/branches/bootstrap-first-branch.integration.test.ts`

```typescript
export interface SignupBranchInput {
  name: string;
  state: string;
  city: string;
  street: string;
  exteriorNumber: string;
  phone: string;
  rfc?: string | null;
  startOperations?: string | null;
  endOperations?: string | null;
  timezone: string;
}

export async function bootstrapBranchDefaults(tx: PrismaTx, branchId: string) {
  // Categorías predeterminadas para reducir fricción en onboarding
  // El usuario puede editarlas/eliminarlas después según su tipo de negocio
  const categories = ['Entradas', 'Platos principales', 'Bebidas', 'Postres'];
  for (const name of categories) {
    await tx.menuCategory.create({ data: { name, branchId, status: true } });
  }
  
  // Mesa inicial para comenzar a operar inmediatamente
  await tx.table.create({
    data: { name: 'Mesa 1', branchId, userId: SYSTEM_OR_BOOTSTRAP_USER, status: true, availabilityStatus: true },
  });
}
```

**Salida:** alta pública crea primera sucursal operativa.

---

### Fase 2.5 — Frontend sucursales

**Tareas:**

- [ ] `BranchSwitcher` en header (visible si >1 sucursal)
- [ ] Página `/settings/branches` (tabla CRUD, solo owner)
- [ ] Signup paso 2: datos sucursal
- [ ] `MultiSelect` sucursales en modal usuario (rol ≠ admin)
- [ ] Query keys: `['branches', 'list']`, `['branches', id, 'detail']`
- [ ] Component tests

```typescript
// branch.service.ts
export const branchService = {
  list: () => api.get<BranchListItem[]>('/api/branches'),
  create: (body: CreateBranchRequest) => api.post<BranchDetailResponse>('/api/branches', body),
  switchBranch: (branchId: string) =>
    api.post<{ token: string }>('/auth/switch-branch', { branchId }),
};

// Tras switch: invalidar queries operativas
queryClient.invalidateQueries({ queryKey: ['orders'] });
queryClient.invalidateQueries({ queryKey: ['menu'] });
```

**Salida:** UI sucursales + selector operativos.

---

### Fase 2.6 — Migración `Company` → `Branch`

**Objetivo:** Eliminar módulo `Company` (legacy single-tenant) del deploy multi-tenant. Toda configuración operativa ahora vive en `Branch`.

**Contexto:**
- Deploy nuevo: DB vacía, nunca habrá datos en `companies`
- Deploy legacy: NO se toca
- `Branch` ya tiene todos los campos de `Company` (logoUrl, startOperations, ticketConfig, paymentConfig, etc.)

**Tareas (orden de dependencia):**

1. **Backend - Eliminar código de Company:**
   - [ ] Remover registro de rutas en `src/server/routes/index.ts`:
     ```diff
     - import companyRoutes from './company.routes';
     - router.use('/api/company', companyRoutes);
     ```
   - [ ] Eliminar archivos:
     ```bash
     rm src/server/routes/company.routes.ts
     rm -rf src/controllers/company/
     rm -rf src/core/application/use-cases/company/
     rm src/core/application/dto/company.dto.ts
     rm src/core/infrastructure/database/repositories/company.repository.ts
     rm src/core/infrastructure/config/dependency-injection/company.module.ts
     rm src/core/domain/entities/company.entity.ts
     rm src/core/domain/interfaces/company-repository.interface.ts
     ```

2. **Schema Prisma - Eliminar modelo:**
   - [ ] Remover modelo `Company` de `schema.prisma`:
     ```diff
     - model Company {
     -   id              String   @id @default(uuid())
     -   name            String
     -   // ... resto de campos
     -   @@map("companies")
     - }
     ```
   - [ ] Generar migración: `npx prisma migrate dev --name remove_company_table`
   - [ ] Verificar que genera: `DROP TABLE "companies";`

3. **Validación:**
   - [ ] Compilar sin errores: `npm run build`
   - [ ] Verificar imports rotos: `npx tsc --noEmit`
   - [ ] Endpoints `/api/company` responden 404
   - [ ] Endpoints `/api/branches/:id` funcionan

4. **Frontend (Fase 2.5 - referencia):**
   - [ ] Reemplazar `CompanyConfigPage` por listado/detalle sucursal
   - [ ] Cambiar calls de API:
     ```typescript
     // ANTES
     GET /api/company
     PUT /api/company
     
     // DESPUÉS
     GET /api/branches/:branch_id    // branch_id del JWT
     PATCH /api/branches/:branch_id
     ```

5. **Storage (solo si migración legacy):**
   - [ ] Logos: `companies/logo.png` → `branches/{branchId}/logo.{ext}`
   - [ ] Nota: NO aplica a deploy nuevo (DB vacía)

**Comparativa:**

| Legacy | Nuevo |
|--------|--------|
| `GET/PUT /api/company` | `GET/PATCH /api/branches/:id` |
| `companyService` | `branchService` |
| Config global | Config por sucursal activa |
| 1 empresa = N sucursales | N sucursales independientes |

**Salida:** Sin módulo `Company` en instancia nueva. ~11 archivos eliminados + 1 modelo Prisma.

---

### Fase 2.7 — Tests del módulo

**Tareas:**

- [ ] API: límite 3 sucursales, aislamiento branch A/B, disable bloquea órdenes
- [ ] Frontend: selector, modal límite plan
- [ ] E2E: signup → orden → 2ª sucursal → switch → menú independiente

**Storage R2 (sucursal):**

```text
branches/{branchId}/logo.{ext}
branches/{branchId}/products/{productId}.{ext}
```

Limpieza en cron hard-delete org (Etapa C.3): borrar prefijos de todas las sucursales de la org.

#### Checklist Etapa 2 (DoD)

- [x] CRUD API con permisos `owner` ✅
- [x] `max_branches` → 409 ✅
- [x] `user_branch_access` + switch-branch ✅ (funcionalmente completo, falta refactoring)
- [x] Servicios bootstrap primera sucursal ✅ (listo para integración en signup 4.1)
- [ ] UI: pantalla Sucursales + selector header (Fase 2.5)
- [ ] `Company` deprecado (Fase 2.6)
- [ ] POS usa `branchId` del contexto, no del body (Etapa 3)

---

## Etapa 3 — Adaptar Restify actual

**Objetivo:** Que todo el código del POS (órdenes, menú, mesas, pagos, etc.) use el filtrado automático por organización y sucursal que ya construimos en la Etapa 1.

**Estado: ❌ Pendiente** — La infraestructura de aislamiento (TenantContext + Prisma Extension) existe pero NO está conectada a los repositorios. Actualmente `prisma.module.ts` inyecta `getBasePrisma()` (sin filtros) a los 18 repositorios del POS.

**No hay crons ni jobs programados.** Solo existen 2 webhooks (Stripe y Mercado Pago) que necesitan ajuste.

---

### Tarea 3.1 — Cambiar la inyección de Prisma

**Qué:** Modificar `prisma.module.ts` para que inyecte `getPrisma()` (con tenant extension) en vez del PrismaClient base.

**Por qué:** Es el switch central. Un solo cambio hace que todos los repositorios empiecen a filtrar automáticamente por org/branch.

**Archivo:** `src/core/infrastructure/config/dependency-injection/prisma.module.ts`

**Cambio:**
```typescript
// ANTES (sin filtros)
export const prismaClient: PrismaClient = prismaService.getClient();

// DESPUÉS (con filtrado por tenant)
export const prismaClient = getPrisma();
```

**Precaución:** Después de este cambio, cualquier query que se ejecute sin contexto de tenant va a fallar con `TENANT_ORG_REQUIRED` o `TENANT_BRANCH_REQUIRED`. Por eso las tareas 3.2 y 3.3 son de validación.

- [ ] Cambiar la inyección en `prisma.module.ts`
- [ ] Verificar que la app arranca sin errores
- [ ] Marcar con `withoutTenant` los casos que NO deben filtrarse (signup, scripts admin)

---

### Tarea 3.2 — Validar repos nivel-org

**Qué:** Verificar que los repositorios que filtran por `organizationId` funcionan correctamente.

**Repos afectados:** `user.repository.ts`, `subscription.repository.ts`

- [ ] Login sigue funcionando (el usuario se busca por email, luego se valida que pertenece a una org activa)
- [ ] CRUD de usuarios filtra solo los de la org del JWT
- [ ] Consulta de suscripción devuelve solo la de la org actual
- [ ] Verificar que `organization.repository.ts` y `subscription-plan.repository.ts` siguen sin filtro (son modelos globales)

---

### Tarea 3.3 — Validar repos nivel-branch

**Qué:** Verificar que los repositorios que filtran por `branchId` funcionan correctamente.

**Repos afectados (14):** `order`, `table`, `menu-item`, `menu-category`, `payment`, `payment-session`, `payment-differentiation`, `product`, `expense`, `refund`, `employee-salary-payment`, `reports-summary`

- [ ] Crear orden → se le asigna `branchId` del contexto automáticamente
- [ ] Listar órdenes → solo devuelve las de la sucursal activa
- [ ] Listar menú → solo items de la sucursal activa
- [ ] Listar mesas → solo de la sucursal activa
- [ ] Pagos, gastos, productos → misma validación
- [ ] El menú público (`list-public-menu`) funciona correctamente (usa `branchId` de parámetro, no de JWT)
- [ ] Reportes/dashboard filtran por branch

---

### Tarea 3.4 — Ajustar webhooks

**Qué:** Los 2 webhooks reciben llamadas externas sin JWT, así que no tienen contexto de tenant. Hay que buscar los datos por identificadores únicos del servicio externo.

**Webhook Stripe** (`POST /api/subscription/webhooks/stripe`):
- [ ] Buscar suscripción por `stripeSubscriptionId` (viene en el evento) en vez de `subscriptionRepository.find()` genérico

**Webhook Mercado Pago** (`POST /api/payments/webhooks/mercado-pago`):
- [ ] Al crear un pago, incluir `orgId` + `branchId` en el `external_reference`
- [ ] En el webhook, extraer esos IDs del `external_reference` y usarlos para filtrar el pago correcto

---

### Tarea 3.5 — Tests de aislamiento

**Qué:** Verificar que una organización nunca ve datos de otra.

- [ ] Crear 2 organizaciones con 2 sucursales cada una (puede ser con seed de test)
- [ ] Desde org A, intentar listar/crear/editar datos → solo ve los suyos
- [ ] Desde org A sucursal 1, intentar ver datos de sucursal 2 → no los ve
- [ ] Intentar acceder con un `branchId` de otra org → error (no leak de existencia)
- [ ] Smoke test manual: operar el POS completo y confirmar que todo funciona

---

## Etapa 3.5 — Aislar stock y recetas (merge de `qa`)

**Objetivo:** Dar aislamiento multi-tenant a las tablas que llegaron del merge de `qa` (sistema de stock/inventario y recetas). Actualmente `StockMovement` y `MenuItemIngredient` **no tienen `branchId`**, no están en la tenant extension, y sus servicios usan el cliente Prisma base (`getClient()`), por lo que **no filtran por sucursal** (leak de aislamiento).

**Estado: ✅ Completa** — `branchId` + extension + servicios + tests de aislamiento (8/8 verde contra DB real).

**Contexto:**
- `MenuItemIngredient` (recetas) es hija de `MenuItem` → el padre ya tiene `branchId`.
- `StockMovement` (ledger de inventario) es hija de `Product` → el padre ya tiene `branchId`.
- Estrategia elegida: **`branchId` directo + tenant extension** (consistente con las otras 14 tablas branch-level), en lugar de filtrado derivado del padre.
- `StockMovement` se escribe dentro de la transacción de creación de orden (vía `recordSalesBatch`, que recibe el `tx` base). Dentro de `$transaction` la extension **no se propaga**, así que el `branchId` se asigna **explícitamente** (igual que en los use-cases de orders ya mergeados).

**Archivos afectados (referencia):**

```text
src/core/infrastructure/database/prisma/schema.prisma
src/core/infrastructure/database/prisma/migrations/<nueva>/migration.sql
src/core/infrastructure/database/prisma/tenant-extension.ts
src/core/application/services/recipe.service.ts
src/core/application/services/stock.service.ts
src/core/application/use-cases/orders/create-order.use-case.ts
src/core/application/use-cases/orders/create-public-order.use-case.ts
```

| Tarea | Nombre | Estado |
|------|--------|--------|
| 3.5.1 | Schema: `branchId` en `MenuItemIngredient` | ✅ |
| 3.5.2 | Schema: `branchId` en `StockMovement` | ✅ |
| 3.5.3 | Migración + backfill desde el padre | ✅ |
| 3.5.4 | Tenant extension: registrar ambos modelos | ✅ |
| 3.5.5 | `RecipeService` → `getPrisma()` + `branchId` explícito | ✅ |
| 3.5.6 | `StockService` → `getPrisma()` + `branchId` explícito | ✅ |
| 3.5.7 | `recordSalesBatch`: recibir y propagar `branchId` | ✅ |
| 3.5.8 | Tests de aislamiento (stock + recetas) | ✅ |

---

### Tarea 3.5.1 — Schema: `branchId` en `MenuItemIngredient`

**Qué:** Agregar la columna y relación de sucursal al modelo de recetas.

- [ ] Agregar `branchId String?` al modelo `MenuItemIngredient`
- [ ] Agregar relación `branch Branch? @relation(fields: [branchId], references: [id], onDelete: Cascade)`
- [ ] Agregar `branches MenuItemIngredient[]`/back-relation en `Branch` (si Prisma lo exige)
- [ ] Agregar índice `@@index([branchId])`
- [ ] `prisma validate`

```prisma
model MenuItemIngredient {
  // ... campos existentes ...
  branchId String?
  branch   Branch? @relation(fields: [branchId], references: [id], onDelete: Cascade)

  @@index([branchId])
}
```

---

### Tarea 3.5.2 — Schema: `branchId` en `StockMovement`

**Qué:** Agregar la columna y relación de sucursal al ledger de stock.

- [ ] Agregar `branchId String?` al modelo `StockMovement`
- [ ] Agregar relación `branch Branch? @relation(fields: [branchId], references: [id], onDelete: Cascade)`
- [ ] Back-relation en `Branch` (si Prisma lo exige)
- [ ] Agregar índices `@@index([branchId])` y `@@index([branchId, createdAt])` (reportes por fecha)
- [ ] `prisma validate`

```prisma
model StockMovement {
  // ... campos existentes ...
  branchId String?
  branch   Branch? @relation(fields: [branchId], references: [id], onDelete: Cascade)

  @@index([branchId])
  @@index([branchId, createdAt])
}
```

---

### Tarea 3.5.3 — Migración + backfill desde el padre

**Qué:** Crear la migración que añade las columnas y rellena `branchId` con el valor del registro padre (no debe quedar `NULL` en datos existentes).

- [ ] Generar migración (`prisma migrate dev --create-only`) y revisar el SQL
- [ ] Backfill `menu_item_ingredients.branchId` desde `menu_items.branchId`
- [ ] Backfill `stock_movements.branchId` desde `products.branchId`
- [ ] Aplicar y verificar 0 filas con `branchId NULL` (en deploy nuevo la DB está vacía → no-op, pero dejar el SQL listo)

```sql
-- Backfill recetas
UPDATE menu_item_ingredients mii
JOIN menu_items mi ON mi.id = mii.menuItemId
SET mii.branchId = mi.branchId;

-- Backfill movimientos de stock
UPDATE stock_movements sm
JOIN products p ON p.id = sm.productId
SET sm.branchId = p.branchId;
```

---

### Tarea 3.5.4 — Tenant extension: registrar ambos modelos

**Qué:** Que la extension filtre automáticamente estas tablas por `branchId`.

- [ ] Añadir `'MenuItemIngredient'` y `'StockMovement'` a `BRANCH_LEVEL_MODELS` en `tenant-extension.ts`
- [ ] Confirmar que NO quedan en el fallback "unknown model → sin filtrado"
- [ ] Verificar que una query sin `branchId` en contexto lanza `TENANT_BRANCH_REQUIRED`

---

### Tarea 3.5.5 — `RecipeService` → `getPrisma()` + `branchId` explícito

**Qué:** Hacer que el servicio de recetas use el cliente extendido y asigne sucursal al crear.

- [ ] Cambiar `prismaService.getClient()` → `getPrisma()` en el constructor/uso
- [ ] En `replaceRecipe` (corre en `$transaction`): asignar `branchId` explícito en cada `create`, tomado del `menuItem` padre o de `getBranchId()`
- [ ] En `addIngredient`: asignar `branchId` explícito
- [ ] Verificar que `getRecipe`/`updateIngredientQuantity`/`removeIngredient` quedan aislados por la extension
- [ ] Compila (`tsc --noEmit`)

---

### Tarea 3.5.6 — `StockService` → `getPrisma()` + `branchId` explícito

**Qué:** Misma adaptación en el servicio de stock (entradas, salidas, ajustes, mermas).

- [ ] Cambiar `prismaService.getClient()` → `getPrisma()` donde aplique (operaciones que abren su propia `$transaction`)
- [ ] En cada `stockMovement.create`/`createMany`: asignar `branchId` explícito
- [ ] `recordPurchase`, `recordAdjustment`, `recordWaste`, reversiones: propagar `branchId`
- [ ] Compila (`tsc --noEmit`)

---

### Tarea 3.5.7 — `recordSalesBatch`: recibir y propagar `branchId`

**Qué:** El batch de ventas corre dentro de la `$transaction` de creación de orden con el `tx` base; necesita el `branchId` como parámetro.

- [ ] Añadir parámetro `branchId: string | null` a la firma de `recordSalesBatch`
- [ ] Incluir `branchId` en las filas de `movementRows` (createMany)
- [ ] Actualizar las llamadas en `create-order.use-case.ts` y `create-public-order.use-case.ts` para pasar el `branchId` del contexto/parámetro
- [ ] Compila (`tsc --noEmit`)

---

### Tarea 3.5.8 — Tests de aislamiento (stock + recetas)

**Qué:** Confirmar que org/sucursal A nunca ve stock ni recetas de B.

- [ ] Receta de un `MenuItem` de sucursal B no es visible/editable desde sucursal A
- [ ] `StockMovement` de sucursal B no aparece en listados/consumos de A
- [ ] Crear orden en sucursal A genera movements con `branchId = A`
- [ ] Query a stock/recetas sin `branchId` en contexto → `TENANT_BRANCH_REQUIRED`

**Salida:** stock y recetas completamente aislados por sucursal, consistentes con el resto del POS. (Reportes de stock se ajustan en una fase posterior.)

---

## Etapa 4 — Producto SaaS

**Objetivo:** alta de clientes y gestión de org/usuarios. **Sin** detalle de CRUD sucursales (Etapa 2).

### Fase 4.1 — Signup, usuarios y org (backend)

**Tareas:**

- [ ] `POST /api/auth/signup` — orquesta org + user; **delega creación de primera sucursal** a servicio Etapa 2.4.
- [ ] Validaciones: email único, slug, password, rate limit.
- [ ] `POST /api/users`, `GET/PATCH`, disable, reset-password (owner).
- [ ] Email verify / resend; cron 7 días sin verificar.
- [ ] `POST /api/organization/close` y `reactivate` (ver transversal C).
- [ ] Tests E2E signup org (con Etapa 2.4 integrada).

**Ejemplo — signup body (org + user; sucursal en Etapa 2):**

```typescript
interface SignupRequest {
  user: {
    email: string;
    password: string;
    name: string;
    lastName: string;
  };
  organization: {
    name: string;
    slug?: string;
  };
  branch: SignupBranchInput; // ver Fase 2.4
  timezone: string; // IANA desde navegador
}
```

**Ejemplo — transacción signup (orquestación):**

```typescript
await withoutTenant(async () => {
  await prisma.$transaction(async (tx) => {
    const org = await createOrganization(tx, input.organization);
    await createSubscriptionFree(tx, org.id);
    const branch = await createFirstBranch(tx, org.id, input.branch, input.timezone);
    const user = await createOwnerUser(tx, org.id, input.user);
    await bootstrapBranchDefaults(tx, branch.id); // Etapa 2.4
    return { org, branch, user };
  });
});
```

**Salida:** owner puede registrarse y crear empleados (asignación sucursales en Etapa 2.3).

---

### Fase 4.2 — Frontend onboarding y org

**Tareas:**

- [ ] Signup paso 1: owner + org (paso 2 sucursal → Etapa 2.5).
- [ ] Wizard onboarding: timezone, logo org (R2), primer producto, primer empleado.
- [ ] Pantalla org settings, usuarios, mi cuenta, cambio password forzado.
- [ ] Banner email verification; cerrar / reactivar cuenta.
- [ ] Paywall oculto si `billingEnabled=false`.
- [ ] Component tests (API mockeada).

**No incluir aquí:** selector sucursales, pantalla Sucursales, `CompanyConfigPage` (Etapa 2.5–2.6).

**Salida:** UX SaaS de org completa; sucursales en Etapa 2.

---

## Transversal — Storage R2

```text
organizations/{organizationId}/logo.{ext}    # Etapa 4
branches/{branchId}/logo.{ext}             # Etapa 2
```

**Endpoint firmado (ejemplo):**

```typescript
// POST /api/uploads/signed-url
// Body: { "kind": "org_logo", "resourceId": "org-uuid" }
// Valida: resourceId === JWT.org
```

Limpieza al hard-delete org: ver Fase C.3 (incluye prefijos de sucursales vía Etapa 2).

---

## Transversal — Cierre y reactivación de cuenta

### Fase C.1 — `POST /api/organization/close` (owner)

- Body: `{ confirmationName }` debe coincidir con `organization.name`.
- `deleted_at = now()`; incrementar `token_version` de todos los users.

### Fase C.2 — `POST /api/organization/reactivate`

- Solo owner dentro de 30 días; otros roles rechazados.

### Fase C.3 — Cron hard-delete (diario 4am)

- Orgs con `deleted_at < now() - 30 days`.
- Borrar R2 org + sucursales (Etapa 2).
- `DELETE` organization (cascades según schema).

---

## Etapa 5 — Go-live

### Fase 5.1 — QA global

**Tareas:**

- [ ] E2E: signup → operar → (Etapa 2: segunda sucursal + switch).
- [ ] Aislamiento IDOR entre orgs.
- [ ] Pen test JWT (`org` / `branch` manipulados).
- [ ] Carga liviana: 50 orgs × 3 sucursales.
- [ ] Checklist OWASP multi-tenant.

### Fase 5.2 — Rollout

**Tareas:**

- [ ] DB vacía + env (`BILLING_ENABLED=false`, `JWT_SECRET`, …).
- [ ] `prisma migrate deploy` + `db seed`.
- [ ] Healthcheck; logs sin `TENANT_*_REQUIRED` inesperados.
- [ ] Feature flag signup público OFF → ON.
- [ ] Plan rollback (revert deploy; legacy intacto).

```bash
npx prisma migrate deploy
npx prisma db seed
```

---

## Definition of Done (programa completo)

### Etapa 1

- [ ] Tenant obligatorio en modelos de dominio.
- [ ] JWT con `org` + `branch` + `tokenVersion`.
- [ ] `GET /api/config` y guards operativos.

### Etapa 2

- [ ] Ver [Checklist Etapa 2](#checklist-etapa-2-dod) arriba.

### Etapa 3–5

- [ ] POS filtrado por sucursal activa.
- [ ] Signup crea org + owner + primera sucursal en una transacción.
- [ ] Deploy nuevo pasa migrate + seed desde cero.

---

## Apéndice — Decisiones diferidas

Billing Stripe activo, multi-org por user, menú compartido entre sucursales, invitación por email, custom domains, DB dedicada enterprise, `audit_log`, export GDPR, refresh tokens, captcha en signup.
