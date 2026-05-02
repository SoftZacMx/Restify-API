# Plan de Implementación — Multi-Tenancy (Org + Sucursales, Shared DB)

## Contexto

Restify pasa de ser una app single-tenant a un SaaS multi-tenant con **dos niveles**:

- **Organización** (tenant raíz) = cuenta SaaS del cliente. Tiene plan, billing, dueño y usuarios.
- **Sucursal** (branch) = local físico. Cada org puede tener N sucursales (free = 3, ampliable). La operación del POS (órdenes, mesas, menú, pagos, gastos) vive **por sucursal**, no por organización.

Estrategia: **shared database** con columnas `organization_id` y `branch_id` en las tablas correspondientes. El aislamiento se garantiza por middleware de Prisma + contexto de request, igual para ambos niveles.

Razones de la elección:
- Simplicidad operacional: una sola DB, una sola migración por release.
- Provisioning de tenants es un `INSERT`, sin infraestructura nueva.
- Costo plano hasta volúmenes altos.
- Permite "graduar" tenants enterprise a su propia DB en el futuro sin migrar al resto.

Trade-off aceptado: el aislamiento es **lógico**, no físico. La disciplina del filtro por `organization_id` / `branch_id` es la línea de defensa, por eso se centraliza en una capa única (middleware Prisma).

### Alcance del despliegue

Este plan se ejecuta sobre **una instancia/deploy nueva con base de datos limpia**. No se migra la prod actual.

- **Clientes existentes**: siguen corriendo en la instancia/deploy single-tenant actual, intacta y aislada. Esa instancia no se toca.
- **Clientes nuevos**: van a la nueva instancia multi-tenant desde el día 1.
- **Repo**: las modificaciones viven en una rama (ej. `feature/multi-tenancy`) que se merge solo al target del nuevo deploy. La rama `main`/legacy sigue alimentando el deploy viejo hasta que se decida sunset.
- **Migración de data**: no aplica. La DB nueva arranca vacía, salvo el seed de catálogo (`subscription_plans` con "Free Legacy").

### Modelo de cuentas

- **Solo el dueño se registra públicamente.** El registro público crea una organización + su primera sucursal + el primer user con rol `owner`.
- **El owner crea internamente al resto de los usuarios** y les asigna a qué sucursales pueden operar.
- **Un user pertenece a una sola organización** (1 user = 1 org). Si la misma persona trabaja en dos restaurantes distintos, son dos cuentas con emails distintos.
- **Un user puede operar 1 o N sucursales de su org**, según se lo asigne el owner. El `owner` y el `admin` tienen acceso implícito a todas las sucursales de su org (no requieren asignación explícita).
- **Sin límites de usuarios por plan en el MVP.** Solo hay límite de sucursales por plan (free = 3, ampliable bajando un número en la tabla `subscription_plans`).
- **Creación de users sin invitación por email.** El owner crea al user directamente con email + password temporal; el user cambia la password en su primer login.

---

## Resumen de fases

| Fase | Nombre | Bloquea a | Estimación |
|------|--------|-----------|------------|
| 1 | Diseño y modelo de datos | 2, 6, 10 | 2 días |
| 2 | Capa de aislamiento (Tenant Context) | 3, 4, 5 | 2-3 días |
| 3 | Auth, permisos y selector de sucursal | 4, 6 | 2-3 días |
| 4 | Auditoría del código existente | 6, 9 | 3-4 días |
| 5 | Jobs, crons y procesos background | 9 | 1-2 días |
| 6 | Self-signup + creación interna de usuarios + sucursales | 7, 10 | 3 días |
| 7 | Frontend: signup, onboarding, sucursales y usuarios | 9 | 4-6 días |
| 8 | Observabilidad | — (paralelo a 6-7) | 1 día |
| 9 | Testing y QA | 10 | 2-3 días |
| 10 | Rollout (deploy nuevo) | — | medio día + monitoreo |

**Total estimado:** 3 semanas de un dev concentrado.

Las fases 1-5 son secuenciales y bloqueantes. Las fases 6-8 pueden paralelizarse en parte. La 9-10 cierran el ciclo.

---

## Fase 1 — Diseño y modelo de datos

**Objetivo:** definir el schema desde cero con `organization_id` y `branch_id` obligatorios (NOT NULL) en las tablas correspondientes. Sin backfill ni migración en pasos: una sola migración limpia sobre DB vacía.

### 1.1 Decisiones de producto (ya tomadas)

- **1 user = 1 org**: el campo `organization_id` y `role` viven directamente en la tabla `users`. No hay tabla `organization_members`.
- **1 org = N sucursales**: free permite hasta 3 sucursales, controlado por la columna `max_branches` en el plan.
- **1 user puede operar N sucursales** (asignación explícita por el owner). Owner y admin tienen acceso implícito a todas.
- **Roles por org**: `owner`, `admin`, `manager`, `waiter`, `chef`. Jerárquicos en la cadena `owner > admin > manager > waiter`; `chef` lateral. **No hay rol `cashier` separado**: el cobro vive en `waiter` y superiores.
- **Menú por sucursal**: cada sucursal tiene su propio menú (categorías y platos independientes). No se comparte entre sucursales.
- **Datos físicos/fiscales por sucursal**, no por org: cada sucursal tiene su propio RFC, dirección, horarios, configuración de tickets, credenciales de Mercado Pago.
- **Slug público de la org**: opcional para el MVP. Si se usa, sirve para URLs (`restify.app/mi-restaurante`) o identificación interna.
- Campo `plan` enum básico desde el día uno (`free`, `pro`, `enterprise`) aunque la lógica de billing venga después.

### 1.2 Diseño de la tabla `organizations`

Pertenece al nivel SaaS. Liviana — solo datos del cliente del SaaS, sin operación.

Campos:
- `id` (UUID o cuid)
- `name` (nombre comercial)
- `slug` (único, opcional)
- `plan` (enum: `free`, `pro`, `enterprise`)
- `status` (enum: `active`, `suspended`, `cancelled`)
- `created_at`, `updated_at`, `deleted_at` (soft-delete)
- **Salida:** schema Prisma de `Organization`.

### 1.3 Diseño de la tabla `branches` (sucursales)

Hereda lo que hoy está en `companies`. Pertenece al nivel operación.

Campos:
- `id`
- `organization_id` (FK a `organizations`, NOT NULL, indexado)
- `name` (ej: "Sucursal Centro")
- `state`, `city`, `street`, `exteriorNumber`, `phone`
- `rfc` (datos fiscales)
- `logoUrl`
- `startOperations`, `endOperations` (horarios "HH:mm")
- `ticketConfig` (JSON, config de tickets térmicos)
- `paymentConfig` (texto encriptado AES-256-GCM con credenciales MP)
- `status` (enum: `active`, `disabled`)
- `created_at`, `updated_at`, `deleted_at`
- Índice `(organization_id, status)`
- **Salida:** schema Prisma de `Branch`.

> Nota: la tabla `companies` actual deja de existir en el schema nuevo — sus datos se mueven a `branches`.

### 1.4 Diseño de la tabla `user_branch_access`

Asignación N:N entre users y sucursales. Solo aplica para roles que **no** son `owner` ni `admin` (esos heredan acceso a todas las sucursales de su org).

Campos:
- `user_id` (FK a `users`)
- `branch_id` (FK a `branches`)
- `created_at`
- PK compuesta `(user_id, branch_id)`
- Índice por `branch_id` (para listar usuarios de una sucursal)

### 1.5 Modificación de la tabla `users`

- Agregar columna `organization_id` (FK a `organizations.id`, **NOT NULL**).
- Agregar columna `role` (enum: `owner`, `admin`, `manager`, `waiter`, `chef`).
- Agregar columna `status` (enum: `active`, `disabled`).
- Agregar columna `must_change_password` (boolean, default `false`).
- Agregar columna `email_verified_at` (DateTime, nullable) — null = no verificado.
- Agregar columna `token_version` (int, default `0`) — se incrementa al cambiar password para invalidar JWTs anteriores.
- Email único globalmente.
- Índices `(organization_id, role)` y `(organization_id, status)`.

### 1.5.1 Tablas auxiliares de auth

- **`email_verification_tokens`**: `id`, `user_id` (FK), `token` (único, indexado), `expires_at`, `created_at`, `used_at` (nullable).
- **`password_reset_tokens`**: `id`, `user_id` (FK), `token` (único, indexado), `expires_at` (15 min desde `created_at`), `created_at`, `used_at` (nullable).
- Ambas con `ON DELETE CASCADE` desde `users` (si se borra el user, los tokens se van con él).

### 1.6 Inventario de tablas a modificar

Recorrer el `schema.prisma` y clasificar cada tabla en uno de tres niveles:

- **Globales** (sin tenant): `subscription_plans`, `system_settings`. No llevan `organization_id`.
- **A nivel org**: `users`, `subscriptions`, `branches` (la propia FK a org), `user_branch_access` (vía sus FKs). Llevan `organization_id` directo o transitivo.
- **A nivel sucursal**: `orders`, `order_items`, `order_item_extras`, `payments`, `payment_sessions`, `payment_differentiation`, `tables`, `menu_categories`, `menu_items`, `expenses`, `expense_items`, `refunds`, `employee_salary_payments`, `products`. Llevan `branch_id` (FK a `branches`, NOT NULL).

**Decisión de redundancia**: las tablas a nivel sucursal **no llevan `organization_id` redundante** — se infiere a través del `branch_id`. Esto evita inconsistencias (org_id apuntando a una org distinta de la del branch).

- **Salida:** lista cerrada con cada tabla y su nivel.

### 1.7 Migración Prisma única (DB nueva, NOT NULL desde día 1)

- Crear tablas `organizations`, `branches`, `user_branch_access`, `email_verification_tokens`, `password_reset_tokens`.
- Crear tablas `subscriptions` (1:1 con `organizations`) y `subscription_plans` (catálogo global). Detalle en 1.10.
- Modificar `users` con `organization_id`, `role`, `status`, `must_change_password`, `email_verified_at`, `token_version`.
- Agregar `branch_id` **NOT NULL** a cada tabla del inventario "a nivel sucursal".
- Agregar `organization_id` **NOT NULL** a cada tabla del inventario "a nivel org".
- Agregar índices compuestos donde haya queries comunes (ej: `(branch_id, created_at)` en `orders`, `(branch_id, status)` en `tables`).
- **Políticas `ON DELETE`** (alineadas con la estrategia de borrado de la sección 1.7.1):
    - `organizations` → `branches`, `users`, `subscriptions`, `user_branch_access`, `email_verification_tokens` (vía user), `password_reset_tokens` (vía user): **CASCADE**.
    - `branches` → `menu_items`, `menu_categories`, `tables`, `products`, `expenses`, `expense_items`, `refunds`, `salary_payments`: **CASCADE**.
    - `branches` → `orders`, `payments`, `payment_sessions`, `payment_differentiation`: **SET NULL** (se conservan; el `branch_id` queda null).
    - `users` → `orders`, `payments`, `expenses`, `salary_payments`: **SET NULL** (se conservan; el `user_id` queda null).
    - `users` → `user_branch_access`, `email_verification_tokens`, `password_reset_tokens`: **CASCADE**.
- Generar y revisar la migración SQL antes de aplicar.

### 1.7.1 Estrategia de borrado y conservación de data

Cuando una organización se cierra, se aplica el siguiente flujo (definido en mayor detalle en la sección de "Cierre de cuenta"):

1. **Día 0** (el owner pide cerrar): se setea `deleted_at = now()` en `organizations`. Inmediatamente:
    - Login bloqueado para todos los users de esa org (mensaje "Tu cuenta fue cerrada. Reactivá antes de [día 30]").
    - Pantalla de "Reactivar cuenta" disponible solo para el owner.
2. **Día 1-30**: data intacta, reactivable en cualquier momento limpiando `deleted_at`.
3. **Día 31** (cron diario): hard delete real:
    - Cascade desde `organizations`: borra `branches`, `users`, `subscriptions`, `user_branch_access`, `menu_items`, `menu_categories`, `tables`, `products`, `expenses`, `expense_items`, `refunds`, `salary_payments`, `email_verification_tokens`, `password_reset_tokens`.
    - **Conservados con SET NULL** en `branch_id` y `user_id`: `orders`, `order_items`, `order_item_extras`, `payments`, `payment_sessions`, `payment_differentiation`. Quedan huérfanos a propósito, accesibles solo para queries de soporte/recuperación.
    - Archivos en R2: borrar todo bajo `organizations/{id}/` y `branches/{id}/`.

**`branches` y `users` nunca se hard-deletean por el owner**. Si quiere "borrar" una sucursal o un user, se setea `status=disabled`. La fila queda, las órdenes/pagos históricos siguen atribuidos.

### 1.8 Seed inicial

- `subscription_plans`: insertar planes `Free Legacy` con `max_branches = 3`, sin `stripePriceId`. Más adelante se agregan los planes pagos.
- **Salida:** `prisma/seed.ts`.

### 1.9 Validar el schema

- `npx prisma validate`.
- Generar el cliente y compilar el proyecto.

### 1.10 Ganchos de billing (sin activar)

Para que encender Stripe más adelante sea ~1 día y no un mini-proyecto, dejar estos hooks listos hoy aunque queden dormidos:

- Enum `SubscriptionStatus` con todos los valores: `FREE`, `TRIALING`, `ACTIVE`, `PENDING`, `PAST_DUE`, `CANCELED`, `EXPIRED`. Hoy todos los registros arrancan en `FREE`.
- Tabla `subscriptions` (1:1 con `organizations`): `id`, `organizationId`, `status`, `planId`, campos de Stripe nullable.
- Tabla `subscription_plans` con columnas: `id`, `name`, `max_branches` (int), `stripePriceId` (nullable), `price` (nullable), `billingPeriod` (nullable). Plan dummy "Free Legacy" sembrado.
- **Invariante:** toda `Organization` tiene una `Subscription(status=FREE)` asociada desde su creación.
- Variable `BILLING_ENABLED=false` en `.env` y `env.example.txt`.

### 1.11 Tests de la fase

Tests acotados al schema, corren con DB de test vacía. No requieren ninguna otra fase.

- `prisma validate` y `prisma migrate deploy` corren limpio sobre DB vacía.
- `prisma db seed` ejecuta sin error y deja el plan "Free Legacy" sembrado en `subscription_plans`.
- Crear `Organization` + `Branch` + `User` en una transacción; verificar que las FKs y NOT NULLs funcionan (no se puede insertar `Branch` sin `organization_id`, ni `User` sin `organization_id`, ni `Order` sin `branch_id`).
- Verificar que `subscription_plans.max_branches` existe con el valor `3` para "Free Legacy".
- Diferido a Fase 2 / 9: tests del filtro automático y tests de aislamiento entre orgs/branches.

---

## Fase 2 — Capa de aislamiento (Tenant Context)

**Objetivo:** garantizar que ninguna query escape sin filtrar por `organization_id` (tablas org-level) o `branch_id` (tablas branch-level), sin que cada dev tenga que acordarse.

### 2.1 Implementar `TenantContext`

- Wrapper sobre `AsyncLocalStorage` con API:
    - `runWithTenant({ organizationId, branchId? }, fn)` — abre el scope.
    - `getCurrentOrganizationId()`, `requireOrganizationId()`.
    - `getCurrentBranchId()`, `requireBranchId()` — lanza si no hay branch en el contexto.
- El `branchId` puede no estar seteado para endpoints que operan a nivel org (ej. listar sucursales, crear sucursal).
- **Salida:** `src/core/infrastructure/tenant/tenant-context.ts`.

### 2.2 Middleware HTTP que setea el contexto

- Después del middleware de auth, leer `organization_id` y (si está) `current_branch_id` del JWT y envolver el resto del request en `runWithTenant`.
- Si la ruta es pública (signup, login, healthcheck) no setear contexto.
- **Salida:** middleware Express + integrado en el bootstrap del server.

### 2.3 Middleware de Prisma — inyección automática del filtro

- Extiende `PrismaClient` con `$extends`.
- Para cada modelo, según su nivel:
    - **org-level**: inyectar `where: { organizationId }` desde el contexto.
    - **branch-level**: inyectar `where: { branchId }` desde el contexto.
    - **globales**: sin filtro.
- Para `create` / `createMany`: inyectar `data: { organizationId }` o `data: { branchId }` automáticamente.
- Si no hay tenant en el contexto y el modelo es del dominio: **lanzar error**, no fallar silenciosamente.
- **Verificación cruzada**: cuando una operación involucra una `branch_id`, validar (al menos en `create`) que esa sucursal pertenece a la `organization_id` del contexto. Defensa contra manipulación.
- **Salida:** `src/core/infrastructure/database/prisma/tenant-extension.ts`.

### 2.4 Helper de bypass controlado

- Función `withoutTenant(fn)` que ejecuta `fn` sin filtros, para casos legítimos (signup, jobs cross-tenant, scripts admin).
- Documentado con grandes letras "úsese con cuidado, justifíquese cada uso".

### 2.5 Tests unitarios del aislamiento

- Test: con orgA en el contexto, `findMany` solo devuelve registros de orgA.
- Test: con branchA en el contexto, `findMany` de orders solo devuelve órdenes de branchA.
- Test: intentar `create` con `branch_id` de otra org falla.
- Test: sin contexto, una query a un modelo del dominio falla con error claro.
- Test: `withoutTenant` permite ver todo.
- **Salida:** suite en `tests/integration/tenant-isolation.test.ts`.

---

## Fase 3 — Auth, permisos y selector de sucursal

**Objetivo:** el JWT carga `organization_id`, `role` y la sucursal actualmente seleccionada. El user puede cambiar de sucursal entre las que tiene asignadas.

### 3.1 Adaptar el flujo de login

- Validar credenciales como hoy.
- Validar que el user esté `active` y la org `active`.
- Cargar `organization_id`, `role`, `token_version` y la lista de sucursales accesibles.
- Determinar la sucursal inicial:
    - `owner` / `admin`: primera sucursal de la org (o última usada si se persiste).
    - Otros roles: si tiene una sola asignada, esa. Si tiene varias, queda sin elegir y el frontend muestra selector.
- Emitir JWT con la sucursal elegida (o sin ella si hay que elegir).
- **Duración del JWT: 8 horas**. Sin refresh tokens — al expirar, el user vuelve a poner password.

### 3.2 Estructura del JWT

```
{
  sub: userId,
  org: organizationId,
  branch: currentBranchId | null,
  role: 'owner' | 'admin' | 'manager' | 'waiter' | 'chef',
  subscriptionStatus: 'FREE' | 'TRIALING' | 'ACTIVE' | 'PENDING' | 'PAST_DUE' | 'CANCELED' | 'EXPIRED',
  tokenVersion: number,
  emailVerified: boolean,
  mustChangePassword?: boolean,
  exp: <8 horas desde emisión>
}
```

- `branch: null` solo se permite en endpoints a nivel org (ver 3.5). Para cualquier endpoint a nivel sucursal, el JWT debe traer `branch`.
- `tokenVersion`: se compara contra `users.token_version` en cada request. Si no coincide, el JWT se invalida (mecanismo para forzar re-login al cambiar password — ver 3.10).
- `emailVerified`: copia de si `users.email_verified_at` es no-null. El frontend lo usa para decidir mostrar el banner de verificación.

### 3.3 Reglas de password

- Mínimo 8 caracteres.
- Al menos una letra y al menos un número.
- Sin obligar mayúsculas ni símbolos.
- Validación tanto en frontend (UX inmediata) como en backend (defense in depth).
- Aplica a: signup público, creación interna por owner, cambio voluntario, reset por email.

### 3.3.1 Forzar cambio de password en primer login

- Si el JWT trae `mustChangePassword: true`, el frontend redirige a "cambiar password" antes de cualquier navegación.
- Endpoint `POST /auth/change-password` que valida la temporal, la reemplaza, limpia el flag, **incrementa `token_version`** y emite JWT nuevo.
- Hasta que se cambie, los endpoints sensibles devuelven 403.

### 3.3.2 Recovery de password (olvidé mi contraseña)

Mantiene el flujo actual de Restify, con ajustes mínimos:

- **`POST /auth/forgot-password`**:
    - Recibe `{ email }`.
    - **Siempre devuelve la misma respuesta genérica** (`200 OK` + mensaje "Si tu email existe, recibirás un link"), sin importar si el email existe, si el user está deshabilitado, o si la org está suspendida. Evita confirmar a un atacante si el email está en el sistema.
    - Internamente: si el email existe y el user/org están activos, generar un token aleatorio (32 bytes hex), guardar en `password_reset_tokens` con `expires_at = now() + 15 min`, y enviar email con el link.
    - Si el user está deshabilitado o la org suspendida/cerrada, no se manda nada pero la respuesta sigue siendo idéntica.
- **`POST /auth/reset-password`**:
    - Recibe `{ token, newPassword }`.
    - Valida que el token exista, no esté usado, y `expires_at > now()`.
    - Actualiza la password (hash bcrypt), marca `used_at`, **incrementa `token_version`** del user. Esto invalida cualquier JWT activo en otros dispositivos.
    - Devuelve éxito; el frontend redirige a login.
- **Link de reset**: válido 15 minutos. Después expira y hay que pedirlo de nuevo.

### 3.4 Sistema de roles (RBAC scoped)

- Roles definidos en enum: `owner`, `admin`, `manager`, `waiter`, `chef`.
- Jerarquía: `owner > admin > manager > waiter` con herencia hacia abajo. `chef` lateral.
- Permisos por rol (resumen):
    - `owner`: todo + gestión de usuarios + crear/editar sucursales + plan/billing + borrar/transferir la org.
    - `admin`: operación completa del POS en cualquier sucursal de su org + reportes completos + (futuro) crear usuarios.
    - `manager`: cancelar órdenes, abrir/cerrar caja, ver reportes (de su sucursal actual).
    - `waiter`: tomar órdenes y **cobrarlas** (de su sucursal actual).
    - `chef`: marcar platos listos, ver KDS (de su sucursal actual).
- Helper `requireRole(role)` o `requireAnyRole([...])` en endpoints, lee del JWT.
- **Salida:** decoradores/middlewares de autorización + tests.

### 3.5 Endpoints a nivel org vs nivel sucursal

- **Nivel org** (no requieren `branch` en el JWT, solo `organization`): listar sucursales, crear/editar sucursal, gestión de usuarios, configuración de la org, reportes consolidados (owner/admin).
- **Nivel sucursal** (requieren `branch` en el JWT): todo el POS — órdenes, mesas, menú, pagos, gastos, reportes por sucursal.

El middleware de Fase 2 hace la verificación: si el endpoint es nivel sucursal y no hay `branch` en el contexto, devuelve `400 branch_required`.

### 3.6 Endpoint `POST /auth/switch-branch`

- Para users con varias sucursales asignadas, permite cambiar la sucursal actual.
- Recibe `{ branchId }`, valida que el user tenga acceso, emite un JWT nuevo con `branch: branchId`.
- Owner/admin pueden switchear a cualquier sucursal de su org. El resto solo a las que tiene en `user_branch_access`.

### 3.7 `subscriptionGuard` con early-return (apagado por flag)

- Middleware aplicado a rutas protegidas (después del tenant middleware).
- Lee `process.env.BILLING_ENABLED`. Si es distinto de `'true'`, hace `next()`.
- Si está activo: lee `organization.subscription.status` y bloquea con `402 subscription_required` si no es `ACTIVE` ni `TRIALING`.

### 3.8 Refresh y suspensión mid-session

- El JWT firmado por sí solo no detecta una org suspendida ni un cambio de password después de emitido.
- En el middleware de tenant, agregar un check ligero (cacheado en memoria con TTL de 30-60s) que valide:
    - `organization.status === 'active'` (no `suspended`/`cancelled`/`deleted_at`).
    - `user.status === 'active'`.
    - **`user.token_version === jwt.tokenVersion`** (defensa contra JWT viejo después de cambio de password).
    - Si el JWT trae `branch`, que esa branch siga existiendo, esté `active`, y siga perteneciendo a la org del user.
- Si algo falla, devolver 401/403 y forzar re-login.

### 3.9 Endpoint `GET /api/config` (público)

- No requiere autenticación.
- Devuelve la configuración runtime que el frontend necesita conocer al iniciar:
    ```
    {
      "billingEnabled": false,
      "appVersion": "1.0.0",
      "supportEmail": "soporte@restify.app",
      "passwordRules": { "minLength": 8, "requireLetter": true, "requireNumber": true }
    }
    ```
- El frontend lo consume al cargar y guarda el resultado en memoria.
- Cuando se quiera prender billing, no hace falta redesplegar el frontend: solo cambiar `BILLING_ENABLED=true` en backend y los users al recargar ven el nuevo valor.

### 3.10 Tests de la fase

Tests unitarios sobre auth/JWT/guards. No requieren frontend ni signup completo (se mockea el repositorio o se siembra un user a mano).

- Login emite JWT con el shape correcto (`sub`, `org`, `branch`, `role`, `subscriptionStatus`, `tokenVersion`, `emailVerified`, `mustChangePassword`).
- Login auto-elige sucursal: con 1 asignada la incluye, con N deja `branch: null` para roles ≠ owner/admin.
- JWT expira a las 8 horas exactas.
- `requireRole` y `requireAnyRole` permiten/rechazan según el JWT.
- **Reglas de password**: rechaza < 8 chars, sin letra, sin número; acepta `abc12345`.
- **Recovery de password**:
    - `POST /auth/forgot-password` siempre devuelve 200 con el mismo mensaje (existente, deshabilitado, inexistente).
    - Solo se envía mail si user/org están activos.
    - Token expira en 15 min; intentar usarlo después → 410 Gone.
    - Token usado dos veces → segundo intento falla.
    - Reset incrementa `token_version` y emite JWT nuevo.
- **Token version**: JWT con `tokenVersion` que no coincide con `users.token_version` → 401.
- `POST /auth/switch-branch`:
    - `waiter` con asignación válida → JWT nuevo con la branch elegida.
    - `waiter` intenta sucursal no asignada → 403.
    - `owner` puede ir a cualquier sucursal de su org.
    - Intenta sucursal de otra org → 404 (no leakear existencia).
- `subscriptionGuard`:
    - Con `BILLING_ENABLED=false` → pasa todo.
    - Con `BILLING_ENABLED=true` y subscription `FREE` → 402.
    - Con `BILLING_ENABLED=true` y subscription `ACTIVE` → pasa.
- Check de refresh (3.8): JWT válido pero org `suspended` → 401/403; user `disabled` → idem; branch `disabled` → idem; `tokenVersion` viejo → idem.
- `mustChangePassword=true` bloquea endpoints sensibles aunque el JWT sea válido.
- `GET /api/config` devuelve `billingEnabled` según la env, sin requerir auth.
- Diferido a Fase 9: pen test de manipulación del JWT (firma + payload).

---

## Fase 4 — Auditoría del código existente

**Objetivo:** que el 100% del código actual respete el aislamiento por org y por sucursal.

### 4.1 Inventario de accesos a Prisma

- Grep de `prisma.` y `PrismaClient` en todo `src/`.
- Listar cada archivo y la operación.
- Marcar para cada uno qué nivel debería respetar (org / sucursal / global).
- **Salida:** spreadsheet con cada uso.

### 4.2 Reemplazar import directo por `getPrisma()`

- Crear un único punto de acceso al cliente extendido (con el middleware de fase 2.3).
- Refactorizar todos los imports a usar ese helper.

### 4.3 Marcar excepciones legítimas

- Endpoints públicos (signup), scripts, jobs cross-tenant: envolver en `withoutTenant` con comentario justificando.

### 4.4 Regla de lint custom (recomendado)

- Una rule ESLint que prohíba `import { PrismaClient }` fuera de la capa de infraestructura.

### 4.5 Tests de aislamiento por endpoint

- Para los endpoints más críticos (orders, payments, menu, users, branches): test que crea data en orgA-branchA y orgB-branchB, autentica como user de orgA-branchA, verifica que solo ve data de su scope.
- Verificar también el caso intra-org: user de orgA-branchA no debe ver data de orgA-branchB si no tiene acceso a branchB.

### 4.6 Smoke test manual

- Crear dos orgs con varias sucursales cada una, users en distintas sucursales, recorrer manualmente las pantallas viendo que el aislamiento funciona en ambos niveles.

---

## Fase 5 — Jobs, crons y procesos background

**Objetivo:** todos los procesos sin request HTTP siguen respetando el aislamiento.

### 5.1 Inventario de jobs

- Listar todos los workers, crons, queues, scripts.
- **Salida:** lista con cada job y su tipo: per-branch, per-org, cross-tenant, o sistema.

### 5.2 Jobs per-branch / per-org

- Cada job inicia con `runWithTenant({ organizationId, branchId? }, async () => { ... })`.
- El productor del job persiste el `organizationId` y `branchId`, el consumidor los restaura.

### 5.3 Jobs cross-tenant

- Patrón: iterar `organizations` con `withoutTenant` y para cada una hacer `runWithTenant`.

### 5.4 Auditar scripts existentes

- Cada script debe ser explícito: bootstrap (`withoutTenant`), tenant-específico (recibe `orgId` por argumento), branch-específico (recibe `orgId` + `branchId`).

### 5.5 Webhooks externos (Stripe, MercadoPago, etc.)

- Resolver `organization_id` y `branch_id` desde el payload o tabla de routing (`mercado_pago_external_reference` debe traer ambos identificadores, no solo uno).
- Setear contexto antes de procesar.
- Aplicable **hoy mismo** para MercadoPago (pagos de órdenes), no solo a futuro para Stripe (billing).

### 5.5.1 Webhook de Stripe con `BILLING_ENABLED=false`

- El endpoint `POST /webhooks/stripe` se monta **siempre** desde el día 1, no condicionado al flag.
- Dentro del handler:
    1. Validar firma de Stripe (siempre, defensa de seguridad).
    2. Si `process.env.BILLING_ENABLED !== 'true'` → log "billing disabled, ignoring webhook event {type}" y devolver 200. **No procesa nada.**
    3. Si está prendido → procesa normalmente (actualiza `subscriptions`, etc.).
- Beneficio: encender billing es solo flipear la variable, sin redesplegar.
- Beneficio: el endpoint puede testearse en staging con eventos reales antes de prenderse en prod.

### 5.6 Tests de la fase

Tests acotados a la mecánica de contexto en jobs/webhooks. Se prueban con jobs sintéticos, sin necesidad de la cola real.

- Job per-branch: dentro de `runWithTenant({ orgId, branchId }, ...)`, las queries solo ven data de esa branch. Fuera del callback, las queries fallan por falta de contexto.
- Job cross-tenant: iterar sobre N orgs en secuencia con `runWithTenant` para cada una; verificar que ninguna iteración filtra data de las otras (probar con data sembrada en 2 orgs distintas).
- Webhook MercadoPago: con un payload válido, resuelve `organization_id` y `branch_id` y procesa con el contexto correcto. Con un payload sin esos identificadores, rechaza con error claro (no procesa con contexto faltante).
- Webhook con `external_reference` apuntando a una org/branch que no existe → rechaza, no crea data huérfana.
- Diferido a Fase 9: tests de carga con jobs concurrentes.

---

## Fase 6 — Self-signup + creación de usuarios y sucursales

**Objetivo:** tres flujos.
- **Público**: el dueño se registra y crea su organización + primera sucursal.
- **Privado** (autenticado): el owner crea más sucursales.
- **Privado** (autenticado): el owner crea usuarios y les asigna sucursales.

### 6.1 Endpoint público `POST /api/auth/signup`

Recibe:
- Datos del user: email, password, nombre completo.
- Datos de la org: nombre comercial, slug (opcional, auto-generado si no se manda).
- Datos de la primera sucursal: nombre, dirección, RFC, horarios, etc.
- Zona horaria del navegador (IANA, ej. `America/Mexico_City`).

### 6.2 Validaciones del signup público

- Email único globalmente.
- Slug auto-generado del nombre de la org (kebab-case, sin acentos). Si choca con uno existente, se sufija con `-2`, `-3`, etc. Lista de slugs reservados bloqueada (`admin`, `api`, `app`, `login`, `signup`, `dashboard`, `billing`, `webhooks`, `auth`, etc.).
- Password policy (sección 3.3).
- Anti-bot: rate limit por IP, captcha opcional (decisión de despliegue).

### 6.3 Transacción de creación de la org

Dentro de `withoutTenant` y un `prisma.$transaction`:
1. Crear `Organization` (status `active`, plan `free`, `slug` calculado).
2. Crear `Subscription` con `status: FREE`, asociada a la org.
3. Crear `Branch` (primera sucursal) con todos los datos del local + `timezone` recibida + `currency: 'MXN'`.
4. Crear `User` con `organization_id`, `role: owner`, `must_change_password: false`, `email_verified_at: null`, `token_version: 0`.
5. Bootstrap de datos iniciales para la primera sucursal:
    - Categorías de menú: `Entradas`, `Platos principales`, `Bebidas`, `Postres` (4 filas en `menu_categories` con `branch_id` apuntando a la nueva).
    - 1 fila en `tables` con `name: "Mesa 1"`, `availabilityStatus: true`.
6. Crear token de verificación de email en `email_verification_tokens` (vence en 7 días).
7. Si algo falla, todo se revierte.

### 6.4 Respuesta del signup público

- Devolver JWT con `organization_id`, `branch: <id de la primera sucursal>`, `emailVerified: false`.
- Disparar dos emails asíncronos (no bloquean):
    - Email de bienvenida.
    - Email con link de verificación (`/auth/verify-email/:token`).

### 6.5 Endpoint privado `POST /api/branches` (crear sucursal)

Solo accesible para `owner`.
Recibe: nombre, dirección, RFC, horarios, ticket config, payment config.

Lógica:
1. Validar que el caller es `owner`.
2. Validar que la org no superó el límite del plan (`subscription_plans.max_branches`). Si sí, devolver `409 branch_limit_reached`.
3. Crear la sucursal con `organization_id` del caller.
4. Devolver la sucursal creada.

### 6.6 Endpoints complementarios de gestión de sucursales

- `GET /api/branches` — listar sucursales de la org (todos los roles ven; el frontend filtra según acceso).
- `PATCH /api/branches/:id` — editar (`owner`).
- `POST /api/branches/:id/disable` — desactivar (`owner`). Una sucursal desactivada no puede recibir órdenes; data histórica queda intacta.
- `DELETE /api/branches/:id` — borrar (soft-delete; solo si no tiene actividad reciente; `owner`).

### 6.7 Endpoint privado `POST /api/users` (creación interna)

Solo accesible para `owner`.
Recibe:
- email, nombre completo, rol (`admin`, `manager`, `waiter`, `chef` — nunca `owner`).
- `branchIds`: array de sucursales asignadas. Obligatorio para `manager`/`waiter`/`chef`. Para `admin` se ignora (acceso implícito a todas).

Lógica:
1. Validar caller `owner` y rol pedido válido.
2. Validar email único globalmente.
3. Validar que cada `branchId` pertenezca a la org del caller.
4. Generar password temporal aleatoria (16 caracteres).
5. Crear `User` con `organization_id` del caller, `must_change_password: true`.
6. Si rol no es `admin`, crear filas en `user_branch_access` para cada branch.
7. Devolver al owner el email + password temporal una sola vez.

### 6.8 Endpoints complementarios de gestión de usuarios

Todos requieren rol `owner`:
- `GET /api/users` — listar usuarios de la org con sus sucursales asignadas.
- `PATCH /api/users/:id` — editar nombre, rol, sucursales asignadas.
- `POST /api/users/:id/disable` — desactivar.
- `POST /api/users/:id/reset-password` — regenerar password temporal.
- `DELETE /api/users/:id` — borrar (soft-delete preferible).

El owner no puede desactivarse ni eliminarse a sí mismo.

### 6.9 Verificación de email (blanda, día 1)

Modelo elegido: el user puede operar de inmediato pero ve un banner amarillo. A los 7 días sin verificar, queda bloqueado hasta hacerlo.

- **`POST /auth/verify-email/:token`**: valida que el token exista, no esté usado, no haya expirado. Marca `email_verified_at = now()` en el user, marca `used_at` en el token. Devuelve éxito.
- **`POST /auth/resend-verification`** (autenticado): genera un token nuevo (invalida los anteriores no usados), envía mail. Rate limit: máximo 3 envíos cada 24h por user.
- **Job diario (cron)**: busca users con `email_verified_at IS NULL` y `created_at < now() - 7 days`. Los pasa a `status: disabled` (no los borra). Al loguearse reciben mensaje "Verificá tu email para continuar" con botón para reenviar el link.
- Una vez verificado, el job lo deja como está.

### 6.10 Tests

- E2E signup público: registro → login → ver sucursal creada → crear primera orden.
- E2E creación de sucursal: owner agrega segunda sucursal → switch a esa sucursal → crear datos → vuelta a la primera y verificar aislamiento entre sucursales.
- E2E creación interna: owner crea waiter asignado a sucursal A → waiter loguea → solo ve sucursal A.
- E2E límite de plan: owner intenta crear 4ta sucursal en plan free → recibe 409.
- Negativos: emails duplicados, rol distinto a `owner` en signup, waiter intentando crear usuarios o sucursales, manipular `branchId` para acceder a una sucursal no asignada.
- Aislamiento: orgA no ve data de orgB; branchA no ve data de branchB dentro de la misma org.

---

## Fase 7 — Frontend: signup, onboarding, sucursales y usuarios

**Objetivo:** la experiencia visible del cambio.

### 7.1 Pantalla pública de signup

- Formulario en 2 pasos:
    1. Datos del owner (email, nombre, password) + datos de la organización (nombre comercial).
    2. Datos de la primera sucursal (nombre, dirección, horarios, RFC).
- Términos y condiciones.
- Copy claro: "Registrá tu restaurante" — no "Registrate como usuario".
- Redirige a onboarding tras éxito.

### 7.2 Onboarding post-registro

Wizard de **4 pasos**, todos skippeables individualmente. El owner puede salir cuando quiera y volver desde la pantalla principal.

1. **Confirmar zona horaria + moneda**: pre-cargado con la timezone del navegador y `MXN`. Botón "Confirmar y continuar".
2. **Subir logo del restaurante** (skippeable): drag-and-drop o click. Sube directo a R2 vía URL firmada.
3. **Crear primer producto**: muestra las 4 categorías default (`Entradas`, `Platos principales`, `Bebidas`, `Postres`) y un mini-form para nombre + precio + categoría.
4. **Crear primer empleado** (skippeable): nombre, email, rol (`waiter` por default), sucursal pre-seleccionada (la única que existe). Al confirmar, muestra la password temporal.

Al final del wizard (o al saltar todo), redirige al dashboard principal con un confeti / mensaje de bienvenida.

### 7.3 Pantalla de "Cambiar contraseña" forzado

- Detecta `mustChangePassword` y bloquea navegación hasta cambiar.

### 7.4 Selector de sucursal en el header

- Visible si el user tiene >1 sucursal disponible (owner/admin: todas las de la org; otros: las asignadas).
- Al elegir, llama a `POST /auth/switch-branch` y actualiza el JWT en el store.
- Cambia el contexto visible: la home, las órdenes, el menú, todo se recarga apuntando a la nueva sucursal.
- Para users con una sola sucursal, no se muestra el selector.

### 7.5 Página "Configuración de la organización"

- Editar nombre, slug, logo (a nivel org), plan actual.
- Solo `owner`.

### 7.6 Página "Sucursales" (la pantalla de cadena)

- Tabla con sucursales: nombre, ciudad, status, cantidad de usuarios asignados, última orden.
- Botón "Crear sucursal":
    - Bloqueado si ya se llegó al límite del plan (mensaje "Tu plan Free permite hasta 3 sucursales. Actualizá para agregar más.").
    - Modal con datos de la nueva sucursal (nombre, dirección, RFC, horarios, ticket config, payment config).
- Acciones por fila: editar, desactivar/reactivar, eliminar.
- Solo `owner`.

### 7.7 Gestión de usuarios

- Tabla con: nombre, email, rol, sucursales asignadas (chips), status, último login.
- Botón "Crear usuario" abre modal:
    - Inputs: nombre, email, rol (select).
    - Si rol ≠ `admin`: aparece selector múltiple de sucursales (obligatorio).
    - Al confirmar, llama al endpoint 6.7 y muestra la password temporal en pantalla de éxito.
- Acción "editar" permite agregar/quitar sucursales asignadas.
- El owner no puede desactivarse ni eliminarse a sí mismo.

### 7.8 Página "Mi cuenta"

- Datos personales del user actual, cambio de password, logout.

### 7.9 Mensajes y estados vacíos

- Empty states amigables: sucursal recién creada sin productos, usuario sin sucursales, etc.

### 7.10 Eliminación del registro abierto en login

- "Registrate" lleva al signup de owner.
- Si un empleado intenta registrarse, copy lo orienta a pedirle la cuenta al dueño.

### 7.11 Banner de verificación de email

- Componente persistente que aparece en todas las páginas autenticadas si el JWT trae `emailVerified: false`.
- Mensaje: "Verificá tu email para mantener tu cuenta activa. Revisá tu bandeja de entrada."
- Botón "Reenviar link" llama a `/auth/resend-verification` y muestra toast de confirmación.
- A los 7 días sin verificar el user queda `disabled` (cron del 6.9): al loguear ve pantalla bloqueada con "Verificá tu email para continuar" + botón de reenviar.

### 7.12 Pantalla "Cerrar mi cuenta" (owner)

- Disponible en "Configuración de la organización".
- Modal de confirmación con doble paso (escribir el nombre del restaurante para confirmar).
- Al confirmar, llama al endpoint correspondiente; setea `deleted_at` en la org.
- Inmediatamente: logout + redirect a una pantalla "Tu cuenta fue cerrada. Tenés hasta [fecha] para reactivarla con tus credenciales actuales."

### 7.13 Pantalla "Reactivar cuenta"

- Si un user de una org con `deleted_at` no nulo (pero todavía dentro de los 30 días) intenta loguearse, el backend devuelve un código especial (`401 organization_deleted_recoverable`) con la fecha límite.
- El frontend muestra una pantalla con "Tu cuenta fue cerrada. ¿Querés reactivarla?" + botón "Reactivar".
- Solo el owner puede reactivar (otros roles ven la pantalla pero el botón está deshabilitado, copy "Pediéle al dueño que reactive la cuenta").
- Al reactivar, se limpia `deleted_at` y el login normal procede.

### 7.11 Tests de la fase

Component tests aislados (Vitest + Testing Library), con la API mockeada. No requieren backend corriendo.

- **Selector de sucursal**: oculto si el user tiene 1 sola; visible si tiene >1; al elegir, dispara el llamado a `switch-branch` y actualiza el store.
- **Formulario de creación de usuario**:
    - Si el rol seleccionado es `admin`, no muestra selector de sucursales.
    - Si el rol es `manager`/`waiter`/`chef`, muestra el multi-select de sucursales y es obligatorio (no permite submit sin elegir).
    - Al éxito, muestra la pantalla de password temporal con botón "Copiar".
- **Pantalla de paywall** (gancho de billing):
    - Con `billingEnabled=false`, la página `/billing` y los avisos no se renderizan.
    - Con `billingEnabled=true` y subscription `FREE`/`EXPIRED`, se renderiza el paywall.
- **Wizard de onboarding**: 4 pasos exactos, cada uno skippeable, datos persisten entre pasos, al final redirige al dashboard.
- **"Cambiar contraseña forzado"**: con `mustChangePassword=true`, intenta navegar a otra ruta → redirige de vuelta. Al cambiar exitoso, libera la navegación.
- **Banner de verificación**: visible si `emailVerified=false`; oculto si `true`. Botón "Reenviar" llama al endpoint y muestra toast.
- **Cerrar cuenta**: el modal exige escribir el nombre del restaurante; sin coincidencia, el botón confirmar queda deshabilitado.
- **Reactivar cuenta**: si el user es owner ve botón habilitado; si es waiter/chef/manager el botón está deshabilitado.
- **Página de Sucursales**: botón "Crear sucursal" deshabilitado cuando se llegó al límite del plan + tooltip explicando.
- Diferido a Fase 9: E2E completos con backend real.

---

## Fase 8 — Observabilidad

**Objetivo:** poder responder "¿qué le pasa al cliente X en su sucursal Y?" sin esfuerzo.

### 8.1 Logger context-aware

- El logger lee `organization_id` y `branch_id` del `TenantContext` y los agrega como campos a cada log.

### 8.2 Métricas por tenant

- Counters/histograms con labels `organization_id` y `branch_id`.
- Cuidado con cardinalidad si llegan a miles de tenants × sucursales.

### 8.3 Errores en Sentry/equivalente

- `setUser({ id, organizationId, branchId })` en cada request.

### 8.4 Dashboard de "tenant health"

- Para soporte: dado un `organization_id`, ver sucursales, últimos errores, requests, uso del plan.

### 8.5 Tests de la fase

Tests de integración que verifican que el contexto se propaga a logger y métricas sin pasarlo manualmente.

- Dentro de `runWithTenant({ organizationId, branchId }, () => logger.info('msg'))`, el log emitido contiene los campos `organization_id` y `branch_id` automáticamente.
- Fuera de un `runWithTenant`, los logs no llevan esos campos (no se inventan valores).
- Las métricas creadas dentro del contexto llevan los labels `organization_id` y `branch_id` correctos.
- Sentry/equivalente: el `setUser` se llama con `{ id, organizationId, branchId }` cuando hay contexto.
- Diferido a Fase 9: validación end-to-end de que un error en un endpoint llega a Sentry con todo el contexto.

---

## Sección transversal — Storage de archivos (Cloudflare R2)

**Objetivo:** logos, fotos de productos y comprobantes se guardan aislados por tenant. Aplica desde Fase 1 (variables de entorno) y se consume en Fase 7 (UI de upload).

### S.1 Servicio elegido

- **Cloudflare R2** (compatible con la API de S3, sin egress fees).
- Variables de entorno: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`.
- SDK: `@aws-sdk/client-s3` apuntando al endpoint de R2 (cambia solo el endpoint).

### S.2 Patrón de naming (aislamiento por path)

```
organizations/{organizationId}/logo.{ext}
branches/{branchId}/logo.{ext}
branches/{branchId}/products/{productId}.{ext}
branches/{branchId}/tickets/{orderId}.pdf
```

**Regla:** cada path **siempre** incluye el id del tenant correspondiente. El backend nunca lee/escribe paths sin verificar primero que el id matchea con el contexto del request.

### S.3 Subida desde el frontend

- Patrón "URL firmada": el backend genera una URL pre-firmada (valida 5 min) que el frontend usa para subir el archivo directo a R2.
- El backend **nunca** maneja el binario del archivo — solo firma operaciones.
- Endpoint: `POST /api/uploads/signed-url` recibe `{ kind: 'logo' | 'product' | 'ticket', resourceId: string }`, valida acceso, devuelve `{ uploadUrl, publicUrl }`.

### S.4 Limpieza al borrar

- Cuando una org se hard-deletea (día 31, ver sección 1.7.1): el cron también borra **todo el contenido bajo `organizations/{id}/` y `branches/{branchId}/`** en R2.
- Cuando un producto se borra: el cron de borrado borra también el archivo de R2 si existe (idempotente: si no existe, no falla).

### S.5 Tests

- Test que verifica que firma URLs solo para paths que incluyen el `organizationId` o `branchId` del contexto.
- Test que rechaza firmar URLs para paths de otra org/branch.
- Diferido a Fase 9: E2E que sube un archivo real y verifica que se accede.

---

## Sección transversal — Cierre y reactivación de cuenta

**Objetivo:** flujo completo de "el owner cierra su cuenta" y de "se arrepiente dentro de los 30 días".

### C.1 Endpoint `POST /api/organization/close` (owner)

- Solo accesible para `owner`.
- Recibe `{ confirmationName }` que debe coincidir exactamente con el nombre de la org (validación anti-error).
- Lógica:
    1. Setea `organizations.deleted_at = now()`.
    2. Incrementa `token_version` de todos los users de la org (invalida JWTs activos en otros dispositivos).
    3. Devuelve éxito; el frontend desloguea inmediatamente.
- A partir de ese momento, todos los logins fallan con código `organization_deleted_recoverable` y la fecha límite de reactivación.

### C.2 Endpoint `POST /api/organization/reactivate` (público pero condicional)

- Recibe `{ email, password }` igual que login.
- Si el user pertenece a una org con `deleted_at` no nulo y `< 30 días`:
    - Si el rol es `owner`: limpia `deleted_at` y procede como login normal.
    - Si el rol no es `owner`: rechaza con mensaje "Solo el dueño puede reactivar la cuenta".
- Si la org está más allá del plazo: rechaza con `404 not_found` (la org está por borrarse, no se puede reactivar).

### C.3 Cron de hard-delete (job diario)

Job que corre 1 vez al día, idealmente en horario de baja actividad (4am):

1. Buscar orgs con `deleted_at < now() - 30 days`.
2. Para cada una, dentro de `withoutTenant` y un `prisma.$transaction`:
    - Listar archivos en R2 bajo `organizations/{id}/` y `branches/{branchId}/` para todas sus branches; borrarlos.
    - Hard delete de la `Organization` (las cascadas y SET NULL definidas en 1.7 hacen el resto).
3. Loggear: org id, cantidad de branches/users/orders afectadas, archivos borrados de R2.

### C.4 Tests

- E2E: owner cierra cuenta → todos los users de la org no pueden loguear → owner reactiva dentro del plazo → todo vuelve a funcionar.
- E2E: owner cierra cuenta → simular paso del tiempo (mock de `now()`) → cron corre → todo borrado en cascada → orders/payments quedan con `branch_id`/`user_id` null.
- Negativos: waiter intenta reactivar (debe rechazar); reactivar fuera del plazo (debe rechazar).

---

## Fase 9 — Testing y QA

**Objetivo:** confianza para desplegar.

### 9.1 Tests E2E del flujo completo

- Signup → login → operación básica en la primera sucursal → crear segunda sucursal → switch → operar → logout → re-login.
- Con dos orgs en paralelo verificando aislamiento entre orgs y entre sucursales.

### 9.2 Tests de aislamiento exhaustivos

- Para cada endpoint mutativo: intentar pasar un `id` de un recurso de otra org/sucursal y verificar 404 (no 403, para no leakear existencia).

### 9.3 Pen test interno

- Manipular el JWT cambiando `org` o `branch`: la firma debe invalidarlo.
- JWT de una org `suspended` o user `disabled`: bloqueo (cubre 3.8).
- Intentar acceder a una sucursal no asignada con el JWT correcto pero `branchId` cambiado en el body: debe rechazar.
- Probar accesos a endpoints sin contexto.

### 9.4 Test de carga liviano

- Simular 50 orgs × 3 sucursales cada una creando datos en paralelo, ver que no hay deadlocks ni regresiones por los nuevos índices.

### 9.5 Revisión de seguridad

- Checklist OWASP enfocado en multi-tenancy: IDOR, broken access control, privilege escalation entre orgs y entre sucursales de la misma org.

---

## Fase 10 — Rollout (deploy nuevo)

**Objetivo:** poner el cambio en una **instancia/deploy nueva** con DB limpia. La instancia legacy single-tenant sigue corriendo intacta para los clientes existentes.

### 10.1 Pre-rollout

- Confirmar que la rama compila, pasa tests y está mergeada al target del nuevo deploy.
- Provisionar la nueva DB vacía y configurar credenciales.
- Setear variables de entorno: `BILLING_ENABLED=false`, `JWT_SECRET`, `DATABASE_URL`, etc.
- Feature flag para "self-signup público" en `off`.

### 10.2 Deploy y migración inicial

1. Deploy del código de la nueva instancia.
2. `npx prisma migrate deploy`.
3. `npx prisma db seed` — inserta el plan "Free Legacy".

### 10.3 Verificación post-deploy

- Healthcheck OK.
- Logs sin errores de "tenant context missing".
- Tests E2E contra el deploy nuevo pasan.

### 10.4 Habilitar signup público

- Flip del feature flag.
- Crear primera cuenta de prueba real.
- Monitoreo intensivo primeras 48h.

### 10.5 Plan de rollback

- DB vacía: rollback es trivial. Revertir el deploy a versión anterior o placeholder.
- La instancia legacy es independiente, no se ve afectada.

### 10.6 Cleanup

- Quitar feature flags de transición.
- Documentar el endpoint del nuevo deploy y el flujo de onboarding en el README.
- Definir criterio de sunset para la instancia legacy (fuera de alcance de este plan).

---

## Criterios de "listo" (Definition of Done)

- [ ] Cualquier query a un modelo del dominio falla si no hay tenant en el contexto.
- [ ] Cualquier query a un modelo branch-level falla si no hay `branch_id` en el contexto.
- [ ] El flujo de signup público crea org + primera sucursal + owner en una sola transacción, en menos de 5 segundos.
- [ ] Toda `Organization` tiene su `Subscription(status=FREE)` asociada. 0 orgs sin subscription.
- [ ] Toda fila branch-level tiene `branch_id` válido apuntando a una sucursal de la misma org del user que la creó.
- [ ] El `subscriptionGuard` está implementado con early-return controlado por `BILLING_ENABLED`.
- [ ] Tests de aislamiento pasan: orgA nunca ve data de orgB; branchA nunca ve data de branchB dentro de la misma org si el user no tiene acceso.
- [ ] El límite `max_branches` del plan se respeta al crear sucursales (409 si se excede).
- [ ] Logs y errores incluyen `organization_id` y `branch_id` automáticamente.
- [ ] La DB nueva pasa `prisma migrate deploy` + `prisma db seed` desde cero sin errores.
- [ ] El cron de hard-delete (sección C.3) está implementado y testeado con orgs que cumplen los 30 días.
- [ ] Storage en R2 está aislado por path con `organizationId`/`branchId` y se limpia al cerrar la cuenta.
- [ ] El endpoint `GET /api/config` está expuesto y responde con `billingEnabled` según la env.
- [ ] El webhook de Stripe está montado y respeta el flag `BILLING_ENABLED`.
- [ ] Existe documentación interna sobre cómo crear un endpoint nuevo respetando multi-tenancy.

---

## Apéndice — Decisiones diferidas (no bloquean este plan)

- **Billing por org**: integración con Stripe a nivel organización. Plan separado.
- **Límites por plan más allá de sucursales** (cantidad de usuarios, items de menú, transacciones/mes): hoy ilimitado.
- **Multi-org por user**: hoy 1:1. Cuando se necesite, se introduce tabla `organization_members`.
- **Menú compartido entre sucursales** (catálogo central de cadena con override de precios por sucursal): hoy cada sucursal es independiente. Si una cadena lo pide, se diseña.
- **Permisos finos por sucursal** (ej. un manager puede en sucursal A pero no en B aunque la tenga asignada): hoy "tenés acceso o no". Granularidad fina cuando aparezca el caso.
- **Invitación por email con token**: hoy creación directa con password temporal.
- **Transferencia de ownership**: endpoint para que un owner traspase el rol a otro user.
- **Custom domains**: no es necesario para abrir el SaaS.
- **Aislamiento físico para enterprise** (mover una org a su propia DB): se diseña cuando un cliente lo pida.
- **Auditoría/historial por org**: tabla `audit_log` con `organization_id` + `branch_id`.
- **Data export** (descargar todos los datos de mi org): requerido para GDPR-friendly. Hoy no se ofrece — el owner tiene 30 días para descargarse manualmente lo que necesite antes del hard-delete.
- **Refresh tokens / "Recordarme"**: hoy JWT de 8h fijo. Si más adelante se quiere experiencia tipo "no me pidas password todos los días", se agrega.
- **Captcha en signup público**: definido como decisión de despliegue. Si aparece spam, se agrega.
