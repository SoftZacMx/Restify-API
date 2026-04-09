# Plan de Implementación — Tabla `subscription_plans`

> **Fecha:** 2026-04-08
> **Proyecto:** Restify API (Backend)
> **Objetivo:** Agregar la tabla `subscription_plans` para gestionar planes de suscripción desde la base de datos en vez de tener un solo `STRIPE_PRICE_ID` hardcodeado.

---

## Contexto Actual

- Existe una tabla `subscriptions` que guarda el estado de la suscripción (ACTIVE, EXPIRED, etc.) vinculada a Stripe.
- El `STRIPE_PRICE_ID` es una variable de entorno — solo soporta 1 plan.
- Se necesitan 2 planes: **Mensual ($3,220)** y **Anual ($31,123)**.
- Arquitectura: Clean Architecture con Prisma, tsyringe (DI), Express.

---

## Fase 1 — Modelo de datos

### 1.1 Crear modelo `SubscriptionPlan` en Prisma

```prisma
model SubscriptionPlan {
  id              String              @id @default(uuid())
  name            String              // "Mensual", "Anual"
  billingPeriod   BillingPeriod       // MONTHLY, ANNUAL
  price           Int                 // Precio en centavos MXN (322000, 3112300)
  stripePriceId   String              @unique
  status          Boolean             @default(true)
  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt

  subscriptions   Subscription[]

  @@map("subscription_plans")
}

enum BillingPeriod {
  MONTHLY
  ANNUAL
}
```

### 1.2 Agregar relación en `Subscription`

```prisma
model Subscription {
  // ... campos existentes ...
  planId                 String?
  plan                   SubscriptionPlan?  @relation(fields: [planId], references: [id])

  @@map("subscriptions")
}
```

### 1.3 Generar y ejecutar migración

```bash
npx prisma migrate dev --name add_subscription_plans
```

### 1.4 Seed de planes iniciales

Crear seed que inserte los 2 planes con sus `stripe_price_id` correspondientes.

### Checklist Fase 1

- [ ] Agregar modelo `SubscriptionPlan` al schema de Prisma.
- [ ] Agregar enum `BillingPeriod`.
- [ ] Agregar campo `planId` y relación en `Subscription`.
- [ ] Generar migración.
- [ ] Crear seed con los 2 planes.

---

## Fase 2 — Capa de Dominio

### 2.1 Crear entidad `SubscriptionPlan`

**Archivo:** `src/core/domain/entities/subscription-plan.entity.ts`

```typescript
export class SubscriptionPlan {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly billingPeriod: 'MONTHLY' | 'ANNUAL',
    public readonly price: number,
    public readonly stripePriceId: string,
    public readonly status: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}
}
```

### 2.2 Crear interfaz de repositorio

**Archivo:** `src/core/domain/interfaces/subscription-plan-repository.interface.ts`

```typescript
export interface ISubscriptionPlanRepository {
  findAll(): Promise<SubscriptionPlan[]>;
  findActive(): Promise<SubscriptionPlan[]>;
  findById(id: string): Promise<SubscriptionPlan | null>;
  findByStripePriceId(stripePriceId: string): Promise<SubscriptionPlan | null>;
}
```

### Checklist Fase 2

- [ ] Crear entidad `SubscriptionPlan`.
- [ ] Crear interfaz `ISubscriptionPlanRepository`.

---

## Fase 3 — Capa de Infraestructura

### 3.1 Implementar repositorio

**Archivo:** `src/core/infrastructure/database/repositories/subscription-plan.repository.ts`

Implementa `ISubscriptionPlanRepository` usando Prisma Client.

### 3.2 Registrar en inyección de dependencias

**Archivo:** `src/core/infrastructure/config/dependency-injection/subscription.module.ts`

Agregar binding de `ISubscriptionPlanRepository` → `SubscriptionPlanRepository`.

### Checklist Fase 3

- [ ] Implementar `SubscriptionPlanRepository` con Prisma.
- [ ] Registrar en módulo de DI.

---

## Fase 4 — Casos de uso

### 4.1 Crear `ListSubscriptionPlansUseCase`

Devuelve los planes activos. El frontend los necesita para mostrar las opciones.

**Archivo:** `src/core/application/use-cases/subscription/list-subscription-plans.use-case.ts`

```typescript
// Retorna planes con status = true, mapeados a DTO
```

### 4.2 Modificar `CreateSubscriptionCheckoutUseCase`

Actualmente toma el `STRIPE_PRICE_ID` del `.env`. Cambiarlo para:

1. Recibir `planId` en el request body.
2. Buscar el plan en la base de datos.
3. Usar el `stripePriceId` del plan para crear la sesión de Stripe.
4. Guardar `planId` en la suscripción.

**Cambios en el DTO:**

```typescript
export const createSubscriptionCheckoutSchema = z.object({
  email: z.string().email(),
  businessName: z.string().min(1).max(200),
  planId: z.string().uuid(),  // NUEVO
});
```

### 4.3 Modificar `HandleSubscriptionWebhookUseCase`

En el evento `checkout.session.completed`, guardar el `planId` en la suscripción. El `planId` se puede pasar en los `metadata` de la sesión de Stripe.

### 4.4 Modificar `GetSubscriptionStatusUseCase`

Incluir info del plan en la respuesta de status:

```typescript
// Agregar al response:
{
  plan: {
    id: string;
    name: string;
    billingPeriod: string;
    price: number;
  } | null
}
```

### Checklist Fase 4

- [ ] Crear `ListSubscriptionPlansUseCase`.
- [ ] Modificar `CreateSubscriptionCheckoutUseCase` para recibir `planId`.
- [ ] Pasar `planId` en metadata de Stripe Checkout Session.
- [ ] Modificar webhook para guardar `planId` en la suscripción.
- [ ] Incluir info del plan en `GetSubscriptionStatusUseCase`.

---

## Fase 5 — Controller y Rutas

### 5.1 Crear controller `ListSubscriptionPlansController`

**Archivo:** `src/controllers/subscription/list-subscription-plans.controller.ts`

### 5.2 Agregar ruta

**Archivo:** `src/server/routes/subscription.routes.ts`

```typescript
// Ruta pública (no requiere auth) — el frontend la necesita antes del login
router.get('/plans', listSubscriptionPlansController.handle);
```

### 5.3 Actualizar controller de checkout

Validar que el request body incluya `planId`.

### Checklist Fase 5

- [ ] Crear controller para listar planes.
- [ ] Agregar ruta `GET /api/subscription/plans`.
- [ ] Actualizar controller de checkout para recibir `planId`.

---

## Fase 6 — Limpiar variable de entorno

### 6.1 Eliminar `STRIPE_PRICE_ID` del `.env`

Ya no se necesita — los price IDs viven en la tabla `subscription_plans`.

### 6.2 Actualizar `StripeSubscriptionService`

El método `createCheckoutSession` ya no recibe el price ID del `.env`, sino como parámetro desde el use case.

### Checklist Fase 6

- [ ] Eliminar `STRIPE_PRICE_ID` del `.env` y `.env.example`.
- [ ] Actualizar `createCheckoutSession` para recibir `stripePriceId` como parámetro.
- [ ] Verificar que no haya más referencias a `STRIPE_PRICE_ID`.

---

## Fase 7 — Frontend

### 7.1 Pantalla de selección de plan

En `SubscriptionBlockedPage` o en una nueva página, mostrar los 2 planes con precio y botón de checkout.

### 7.2 Llamar a `GET /api/subscription/plans`

Obtener los planes disponibles del backend.

### 7.3 Enviar `planId` al crear checkout

Actualizar el servicio de suscripción del frontend para incluir `planId` en el request.

### Checklist Fase 7

- [ ] Consumir endpoint `GET /api/subscription/plans`.
- [ ] Mostrar selector de planes en UI.
- [ ] Enviar `planId` al crear checkout.

---

## Orden de Implementación

```
Fase 1 (Modelo de datos) → Migración + Seed
  │
  ├── Fase 2 (Dominio) → Entidad + Interface
  │
  ├── Fase 3 (Infraestructura) → Repositorio + DI
  │
  ├── Fase 4 (Casos de uso) → Lógica de negocio
  │
  ├── Fase 5 (Controller + Rutas) → API
  │
  ├── Fase 6 (Limpieza) → Eliminar STRIPE_PRICE_ID
  │
  └── Fase 7 (Frontend) → UI de selección de plan
```

---

## Datos para el Seed

| Plan | `name` | `billingPeriod` | `price` (centavos) | `stripePriceId` |
|------|--------|-----------------|---------------------|-----------------|
| Mensual | Mensual | MONTHLY | 322000 | `price_xxx` (crear en Stripe) |
| Anual | Anual | ANNUAL | 3112300 | `price_yyy` (crear en Stripe) |

> **Nota:** Los `stripe_price_id` se obtienen del dashboard de Stripe después de crear los Products/Prices. El precio se guarda en centavos para evitar errores de punto flotante.
