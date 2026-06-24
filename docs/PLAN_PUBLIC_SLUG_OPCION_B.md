# Plan de implementación — URL pública por slug de sucursal (Opción B)

> **Doble propósito:** este documento es a la vez el plan de implementación y el prompt
> de ejecución. Cada fase es **atómica**: compila, pasa tests y se puede mergear y
> desplegar sola sin romper nada. Implementar y revisar en orden.

## Objetivo

Hoy el menú público y la creación de pedidos públicos necesitan un `branchId` que el
frontend nunca envía. La Opción B reemplaza el UUID por un **slug legible por sucursal**:

```
ANTES:   https://app/public/menu?branchId=4f3c9a8b-...-uuid
DESPUÉS: https://app/menu/tacos-el-rey
```

Cada sucursal (`Branch`) tiene su propia URL pública porque el menú, los productos y los
pagos viven a nivel de sucursal, no de organización.

## Principios

- **Sin sobreingeniería.** No se agregan tablas nuevas, dominios personalizados ni
  subdominios. Solo un campo `slug` en `Branch` y un endpoint que traduce `slug → branchId`.
- **El slug es a nivel `Branch`** (no `Organization`). Una organización con N sucursales
  expone N URLs públicas.
- **El backend ya acepta `branchId` por query o body** (`public-tenant.middleware.ts:15`).
  La traducción `slug → branchId` ocurre en el frontend *antes* de pedir menú/crear orden;
  el contrato del `PublicTenantMiddleware` **no cambia**.
- **El `slug` es opcional en la BD** para que las sucursales existentes no rompan; se
  genera en el alta y mediante un backfill para las que ya existen.

## Alcance

- **Backend** (`Restify-API`): Fases 1–4.
- **Frontend** (`Restify-Frontend`): Fases 5–6.
- **Fuera de alcance:** dominios/subdominios por tenant, QR autogenerado (puede venir
  después), edición manual del slug desde UI de administración (Fase 7 opcional).

---

## FASE 1 — Campo `slug` en el modelo `Branch` (BD + entidad)

**Objetivo:** que la base de datos y el dominio conozcan el slug. Nada lo consume aún.

**Atómica porque:** solo agrega una columna nullable y la propaga por las capas. El sistema
sigue funcionando idéntico (nadie lee `slug` todavía).

### Tareas

1. **Schema Prisma** — `src/core/infrastructure/database/prisma/schema.prisma`, modelo `Branch`:
   - Agregar `slug String? @unique` (nullable + único, espejo de `Organization.slug:35`).
   - Agregar índice si no lo cubre el `@unique`: el `@unique` ya crea el índice, no añadir otro.
2. **Migración** — generar con `npx prisma migrate dev --name add_slug_to_branch`.
   - Verificar que la migración solo hace `ADD COLUMN slug ... NULL` + índice único.
   - La columna nace `NULL` para todas las filas existentes (se rellenan en Fase 3).
3. **Entidad de dominio** — `src/core/domain/entities/branch.entity.ts`:
   - Agregar `public readonly slug: string | null` al constructor **al final, después de
     `deletedAt`** (decisión tomada). Así se minimiza el desplazamiento de los 22 args
     posicionales existentes y el riesgo en los call sites.
4. **Mapper del repositorio** — `src/core/infrastructure/database/repositories/branch.repository.ts`:
   - En `toEntity`, agregar `slug` al tipo `row` y pasarlo al `new Branch(...)`.
5. **Otros constructores de `Branch`** — buscar todos los `new Branch(` del repo y de
   `create-first-branch.use-case.ts` y pasarles `slug` (en este punto, `null` o
   `row.slug` según el caso). `grep -rn "new Branch(" src`.

### Criterio de aceptación

- `npx prisma migrate dev` corre limpio; `npx tsc --noEmit` sin errores.
- Tests existentes verdes (puede requerir actualizar fixtures que construyen `Branch`).
- Una sucursal leída de la BD trae `slug: null`.

---

## FASE 2 — Utilidad de generación de slug (pura, sin efectos)

**Objetivo:** una función pura `generateSlug(name)` + estrategia de unicidad, testeable
en aislamiento.

**Atómica porque:** es código nuevo sin call sites; no toca ningún flujo.

### Tareas

1. **Helper** — nuevo archivo `src/shared/utils/slug.util.ts`:
   - `slugify(input: string): string` — minúsculas, sin acentos (normalize NFD + strip
     diacríticos), espacios → `-`, eliminar caracteres no `[a-z0-9-]`, colapsar `-`
     repetidos, trim de `-` en extremos. Ej: `"Tacos El Rey #1"` → `"tacos-el-rey-1"`.
   - Definir longitud máxima (sugerido 60) y fallback si queda vacío (ej. `"sucursal"`).
2. **Resolución de colisiones** — `ensureUniqueSlug(base, exists)`:
   - Recibe el slug base y una función `exists(candidate) => Promise<boolean>`.
   - Devuelve `base` si está libre; si no, prueba `base-2`, `base-3`, … hasta encontrar uno
     libre. Mantener la lógica de BD fuera del helper (se inyecta `exists`).
3. **Tests unitarios** — `tests/unit/shared/slug.util.test.ts`:
   - slugify de acentos, símbolos, espacios múltiples, string vacío.
   - `ensureUniqueSlug` cuando el base está libre, y cuando hay 1, 2, N colisiones.

### Criterio de aceptación

- `slug.util.ts` no importa nada de infraestructura.
- Cobertura de los casos borde listados; tests verdes.

---

## FASE 3 — Asignar slug en alta + backfill de sucursales existentes

**Objetivo:** que toda sucursal nueva nazca con slug y que las existentes lo reciban.

**Atómica porque:** después de esta fase, el invariante "toda sucursal activa tiene slug"
se cumple, pero todavía nadie lo expone públicamente.

### Tareas

1. **Repositorio** — `IBranchRepository` + `BranchRepository`:
   - Agregar `findBySlug(slug: string): Promise<Branch | null>` (se usa en Fase 4 y para
     el `exists` de unicidad).
   - Agregar `slug` a `CreateBranchData` / `UpdateBranchData` y persistirlo en `create`/`update`.
2. **Alta normal** — `create-branch.use-case.ts`:
   - Antes de `create`, generar slug desde `input.name` con `slugify` + `ensureUniqueSlug`
     (usando `branchRepository.findBySlug` como `exists`).
   - Pasar el slug resultante al `create`.
3. **Alta en signup** — `create-first-branch.use-case.ts`:
   - Mismo cálculo de slug. Cuidado: corre dentro de la transacción de signup y
     `withoutTenant`. El chequeo de unicidad debe usar el cliente de la transacción (`tx`),
     no el repo global, para no leer fuera de la transacción.
4. **Backfill** — script `scripts/backfill-branch-slugs.ts`:
   - Recorrer todas las sucursales con `slug = null`, generar slug desde `name`,
     resolviendo colisiones, y persistir.
   - Idempotente: re-ejecutarlo no cambia las que ya tienen slug.
   - Documentar en el encabezado cómo correrlo (`npx tsx scripts/backfill-branch-slugs.ts`).

### Criterio de aceptación

- Crear una sucursal nueva (normal y vía signup) produce un slug único y legible.
- Tras correr el backfill, **ninguna** sucursal activa queda con `slug = null`.
- Dos sucursales con el mismo nombre obtienen `tacos` y `tacos-2`.

---

## FASE 4 — Endpoint público de resolución `slug → branchId`

**Objetivo:** exponer un endpoint público que, dado un slug, devuelva los datos públicos
mínimos de la sucursal (incluido su `id`).

**Atómica porque:** es una ruta nueva aditiva; no modifica las rutas públicas existentes.

### Tareas

1. **Use case** — `src/core/application/use-cases/branches/resolve-public-branch.use-case.ts`:
   - Input `{ slug }`. Usa `branchRepository.findBySlug`.
   - Valida que la sucursal exista y esté `ACTIVE`, y que su organización esté `ACTIVE`
     (mismo criterio fail-secure que `PublicTenantMiddleware.fromBranch:33-37`).
   - Devuelve solo datos públicos: `{ branchId, name, organizationName?, logoUrl, timezone, currency }`.
     **No** exponer `paymentConfig`, `rfc`, ni datos sensibles.
2. **Controller** — `src/controllers/branches/resolve-public-branch.controller.ts`,
   siguiendo el patrón `makeController` de `list-public-menu.controller.ts`.
3. **Ruta** — `src/server/routes/public.routes.ts`:
   - `GET /api/public/branch/:slug` con `publicMenuRateLimiter` (o un rate limiter propio).
   - **No** usar `PublicTenantMiddleware.fromBranch` aquí (ese exige `branchId`, que es
     justo lo que este endpoint resuelve). El use case hace su propia validación.
4. **Tests** — unit del use case: slug válido/ACTIVE, slug inexistente, sucursal DISABLED,
   organización inactiva → error correcto.

### Criterio de aceptación

- `GET /api/public/branch/tacos-el-rey` → 200 con `{ branchId, name, ... }`.
- Slug inexistente o sucursal/organización inactiva → 404 (`BRANCH_NOT_FOUND` / `ORGANIZATION_INACTIVE`).
- Ningún dato sensible en la respuesta.

---

## FASE 5 — Frontend: resolver el slug y propagar el `branchId` (lógica)

**Objetivo:** que el frontend público lea el slug de la URL, lo resuelva a `branchId` y lo
pase a las llamadas de menú y creación de pedido.

**Atómica porque:** prepara repos/hooks para recibir `branchId`. Se puede mergear antes de
cambiar las rutas (Fase 6) sin romper nada, manteniendo compat temporal.

### Tareas (en `Restify-Frontend`)

1. **Repo de branch público** — `src/infrastructure/api/repositories/public-branch.repository.ts`:
   - `resolveBranch(slug: string)` → `GET /api/public/branch/:slug` vía `publicApiClient`.
2. **Propagar `branchId` en repos públicos existentes:**
   - `public-menu.repository.ts` → `getMenu(branchId)` envía `?branchId=`.
   - `public-order.repository.ts` → `createOrder(branchId, data)` incluye `branchId` en el body.
3. **Hook de contexto público** — `usePublicBranch(slug)`:
   - Resuelve el slug a `branchId` (con React Query) y expone `branchId`, `branchName`,
     `isLoading`, `error` (slug inválido → estado de error claro).
4. **Adaptar `usePublicMenu`** para recibir el `branchId` resuelto y pasarlo a `getMenu`.

### Criterio de aceptación

- Con un `branchId` resuelto, `getMenu` y `createOrder` envían el branch correctamente.
- Slug inválido produce un estado de error manejable (no un crash).

---

## FASE 6 — Frontend: rutas públicas basadas en slug

**Objetivo:** cambiar las URLs públicas a `/menu/:slug` y conectar las páginas al contexto de
sucursal.

**Atómica porque:** cierra el flujo end-to-end. Depende de Fase 5 ya mergeada.

### Tareas (en `Restify-Frontend`)

1. **Rutas** — `src/App.tsx`:
   - Nueva ruta raíz pública por slug: `/menu/:slug` → `PublicMenuPage`.
   - Checkout y tracking deben preservar el contexto del slug (ej. `/menu/:slug/checkout`,
     o mantener el slug en estado de navegación / query). Elegir una convención y aplicarla.
   - Decidir el destino de las rutas viejas `/public/menu` y `/public/checkout`:
     dejarlas como redirect temporal o retirarlas (ver Fase 7).
2. **`PublicMenuPage`** — leer `slug` con `useParams`, usar `usePublicBranch(slug)` para
   obtener el `branchId`, pasarlo a `usePublicMenu`. Mostrar estado de carga/erróneo del slug.
3. **`PublicCheckoutPage`** — recibir el `branchId` (vía slug en la URL o navigation state)
   y pasarlo a `createOrder`.
4. **Verificación e2e manual** — abrir `/menu/<slug>` real, ver el menú, crear un pedido,
   confirmar que el pedido se asocia a la sucursal correcta.

### Criterio de aceptación

- `/menu/<slug>` muestra el menú de esa sucursal.
- Crear pedido desde esa URL crea la orden en la sucursal correcta (verificable en BD).
- Un slug inexistente muestra una pantalla de error, no una página rota.

---

## FASE 7 — (Opcional, follow-up) Exponer el slug en administración y retirar rutas viejas

**Objetivo:** que el dueño vea/copie su URL pública y se limpien las rutas legacy.

**Atómica porque:** mejora aditiva; no bloquea el flujo de las fases anteriores.

### Tareas

1. **UI de administración de sucursales** — mostrar la URL pública (`/menu/<slug>`) con botón
   "copiar" en el detalle de la sucursal.
2. **(Opcional) Editar slug** — permitir cambiar el slug validando unicidad; advertir que
   las URLs compartidas previamente dejarán de funcionar.
3. **(Opcional) Generar QR** de la URL pública desde la UI (reutilizar `qrcode.react`,
   ya presente en el frontend).
4. **Retirar** las rutas `/public/menu` y `/public/checkout` legacy una vez confirmado que
   nada externo las usa.

### Criterio de aceptación

- El dueño puede ver y copiar la URL pública de cada sucursal.
- Sin rutas públicas muertas en el router.

---

## Orden de PRs sugerido

| PR | Fases | Repo | Riesgo | Notas |
|----|-------|------|--------|-------|
| 1 | Fase 1 | API | Bajo | Columna nullable + propagación; sin consumidores |
| 2 | Fase 2 | API | Muy bajo | Helper puro + tests |
| 3 | Fase 3 | API | Medio | Alta + backfill; correr backfill al desplegar |
| 4 | Fase 4 | API | Bajo | Endpoint aditivo |
| 5 | Fase 5 | Frontend | Bajo | Lógica; sin cambiar rutas todavía |
| 6 | Fase 6 | Frontend | Medio | Cambia URLs públicas; cierra el flujo |
| 7 | Fase 7 | Frontend | Bajo | Follow-up, opcional |

**Regla de despliegue:** el backend (PRs 1–4, incluido el backfill de Fase 3) debe estar en
producción **antes** de desplegar el frontend (PRs 5–6), para que el endpoint de resolución
y los slugs ya existan cuando el frontend los consuma.
