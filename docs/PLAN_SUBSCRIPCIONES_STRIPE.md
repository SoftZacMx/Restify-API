# Plan de Implementacion - Subscripciones con Stripe (Backend)

## Objetivo

Integrar Stripe Subscriptions en Restify-API para cobrar automaticamente la subscripcion mensual del sistema. Esto elimina el cobro manual y sienta las bases para escalar Restify como SaaS multi-tenant.

> **Alcance:** Solo backend. El frontend se implementara en una fase posterior.

---

## Contexto tecnico actual

- Stripe SDK (`stripe@14.10.0`) ya instalado
- `StripeService` existente en `src/core/infrastructure/payment-gateways/stripe.service.ts` (solo PaymentIntents)
- Webhooks de Stripe ya configurados (`STRIPE_WEBHOOK_SECRET`)
- Arquitectura: Use Cases + Repositories + Handlers (Middy) + DI (tsyringe)
- Base de datos: MySQL con Prisma ORM

---

## Fase 1: Modelo de datos

> **Dependencias:** Ninguna. Esta fase es prerequisito para todas las demas.

### 1.1 Definir enums en Prisma schema

Agregar los siguientes enums al archivo `schema.prisma`:

```prisma
enum SubscriptionStatus {
  ACTIVE
  PAST_DUE        // Pago fallido, en periodo de gracia
  CANCELED         // Cancelada por el usuario
  UNPAID           // Multiples intentos fallidos
  TRIALING         // En periodo de prueba (futuro)
  INCOMPLETE       // Checkout iniciado pero no completado
}

enum PlanInterval {
  MONTHLY
  YEARLY
}
```

### 1.2 Crear modelo `Plan`

Representa los planes de subscripcion disponibles (ej: Basico, Pro, Enterprise).

```prisma
model Plan {
  id                  String       @id @default(uuid())
  name                String       @unique        // "Basico", "Pro", etc.
  description         String?
  price               Decimal      @db.Decimal(10, 2)
  currency            String       @default("MXN")
  interval            PlanInterval @default(MONTHLY)
  stripePriceId       String       @unique        // price_xxx de Stripe
  stripeProductId     String                      // prod_xxx de Stripe
  features            Json?                       // { "maxUsers": 5, "maxTables": 10, ... }
  isActive            Boolean      @default(true)
  createdAt           DateTime     @default(now())
  updatedAt           DateTime     @updatedAt

  subscriptions       Subscription[]
}
```

### 1.3 Crear modelo `Subscription`

Vincula una Company (tenant) a un Plan con estado y datos de Stripe.

```prisma
model Subscription {
  id                      String             @id @default(uuid())
  companyId               String
  planId                  String
  status                  SubscriptionStatus @default(INCOMPLETE)
  stripeSubscriptionId    String?            @unique  // sub_xxx
  stripeCustomerId        String                      // cus_xxx
  currentPeriodStart      DateTime?
  currentPeriodEnd        DateTime?
  cancelAtPeriodEnd       Boolean            @default(false)
  canceledAt              DateTime?
  createdAt               DateTime           @default(now())
  updatedAt               DateTime           @updatedAt

  company                 Company            @relation(fields: [companyId], references: [id])
  plan                    Plan               @relation(fields: [planId], references: [id])

  @@unique([companyId])   // Una subscripcion activa por company
}
```

### 1.4 Crear modelo `SubscriptionInvoice`

Historial de facturas/cobros de la subscripcion.

```prisma
model SubscriptionInvoice {
  id                    String   @id @default(uuid())
  subscriptionId        String
  stripeInvoiceId       String   @unique          // in_xxx
  amountPaid            Decimal  @db.Decimal(10, 2)
  currency              String   @default("MXN")
  status                String                    // "paid", "open", "void", "uncollectible"
  invoiceUrl            String?                   // URL de descarga del invoice en Stripe
  periodStart           DateTime
  periodEnd             DateTime
  paidAt                DateTime?
  createdAt             DateTime @default(now())

  subscription          Subscription @relation(fields: [subscriptionId], references: [id])
}
```

> **Nota:** Agregar `subscriptions Subscription[]` en el modelo `Company` y `invoices SubscriptionInvoice[]` en `Subscription`.

### 1.5 Migracion

```bash
npx prisma migrate dev --name add-subscription-models
```

---

## Fase 2: Seed de Planes en Stripe y BD

> **Dependencias:** Fase 1

### 2.1 Crear productos y precios en Stripe

Usar el Dashboard de Stripe o un script seed para crear:

| Plan       | Precio MXN/mes | Stripe Product   | Stripe Price     |
|------------|----------------|------------------|------------------|
| Basico     | $499.00        | prod_basico_xxx  | price_basico_xxx |
| Pro        | $999.00        | prod_pro_xxx     | price_pro_xxx    |
| Enterprise | $1,999.00      | prod_ent_xxx     | price_ent_xxx    |

### 2.2 Script de seed para la BD

Crear `prisma/seeds/plans.seed.ts`:

```typescript
const plans = [
  {
    name: 'Basico',
    description: 'Ideal para restaurantes pequenos',
    price: 499.00,
    currency: 'MXN',
    interval: 'MONTHLY',
    stripePriceId: 'price_basico_xxx',  // Reemplazar con IDs reales
    stripeProductId: 'prod_basico_xxx',
    features: { maxUsers: 3, maxTables: 10, maxMenuItems: 50 },
  },
  {
    name: 'Pro',
    description: 'Para restaurantes en crecimiento',
    price: 999.00,
    currency: 'MXN',
    interval: 'MONTHLY',
    stripePriceId: 'price_pro_xxx',
    stripeProductId: 'prod_pro_xxx',
    features: { maxUsers: 10, maxTables: 30, maxMenuItems: 200 },
  },
  {
    name: 'Enterprise',
    description: 'Para cadenas y franquicias',
    price: 1999.00,
    currency: 'MXN',
    interval: 'MONTHLY',
    stripePriceId: 'price_ent_xxx',
    stripeProductId: 'prod_ent_xxx',
    features: { maxUsers: -1, maxTables: -1, maxMenuItems: -1 }, // Ilimitado
  },
];
```

---

## Fase 3: Extender StripeService

> **Dependencias:** Fase 1

### 3.1 Agregar metodos de subscripcion al StripeService

Archivo: `src/core/infrastructure/payment-gateways/stripe.service.ts`

```typescript
// --- Customers ---
async createCustomer(params: CreateCustomerParams): Promise<CustomerResult>;
async retrieveCustomer(customerId: string): Promise<CustomerResult>;

// --- Subscriptions ---
async createSubscription(params: CreateSubscriptionParams): Promise<SubscriptionResult>;
async cancelSubscription(subscriptionId: string, cancelAtPeriodEnd?: boolean): Promise<SubscriptionResult>;
async updateSubscription(subscriptionId: string, params: UpdateSubscriptionParams): Promise<SubscriptionResult>;
async retrieveSubscription(subscriptionId: string): Promise<SubscriptionResult>;

// --- Checkout Sessions (alternativa recomendada) ---
async createCheckoutSession(params: CreateCheckoutSessionParams): Promise<CheckoutSessionResult>;

// --- Billing Portal ---
async createBillingPortalSession(customerId: string, returnUrl: string): Promise<BillingPortalResult>;

// --- Webhooks ---
constructWebhookEvent(payload: string | Buffer, signature: string): Stripe.Event;
```

### 3.2 Interfaces nuevas

```typescript
export interface CreateCustomerParams {
  email: string;
  name: string;
  metadata?: Record<string, string>;
}

export interface CreateSubscriptionParams {
  customerId: string;
  priceId: string;
  metadata?: Record<string, string>;
  trialPeriodDays?: number;
}

export interface CreateCheckoutSessionParams {
  customerId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

export interface UpdateSubscriptionParams {
  priceId?: string;      // Cambiar de plan
  cancelAtPeriodEnd?: boolean;
}
```

---

## Fase 4: Domain Layer

> **Dependencias:** Fase 1

### 4.1 Entidad `Plan`

Archivo: `src/core/domain/entities/plan.entity.ts`

```typescript
export class Plan {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly description: string | null,
    public readonly price: number,
    public readonly currency: string,
    public readonly interval: PlanInterval,
    public readonly stripePriceId: string,
    public readonly stripeProductId: string,
    public readonly features: PlanFeatures | null,
    public readonly isActive: boolean,
  ) {}

  static fromPrisma(data: PrismaPlan): Plan { /* ... */ }
}
```

### 4.2 Entidad `Subscription`

Archivo: `src/core/domain/entities/subscription.entity.ts`

```typescript
export class Subscription {
  constructor(
    public readonly id: string,
    public readonly companyId: string,
    public readonly planId: string,
    public readonly status: SubscriptionStatus,
    public readonly stripeSubscriptionId: string | null,
    public readonly stripeCustomerId: string,
    public readonly currentPeriodStart: Date | null,
    public readonly currentPeriodEnd: Date | null,
    public readonly cancelAtPeriodEnd: boolean,
    public readonly canceledAt: Date | null,
  ) {}

  isActive(): boolean {
    return this.status === 'ACTIVE' || this.status === 'TRIALING';
  }

  isPastDue(): boolean {
    return this.status === 'PAST_DUE';
  }

  canAccess(): boolean {
    return this.isActive() || this.isPastDue();
  }

  static fromPrisma(data: PrismaSubscription): Subscription { /* ... */ }
}
```

### 4.3 Interfaces de repositorio

```typescript
// src/core/domain/interfaces/plan-repository.interface.ts
export interface IPlanRepository {
  findAll(): Promise<Plan[]>;
  findById(id: string): Promise<Plan | null>;
  findByStripePriceId(stripePriceId: string): Promise<Plan | null>;
  findActive(): Promise<Plan[]>;
}

// src/core/domain/interfaces/subscription-repository.interface.ts
export interface ISubscriptionRepository {
  findByCompanyId(companyId: string): Promise<Subscription | null>;
  findByStripeSubscriptionId(stripeSubscriptionId: string): Promise<Subscription | null>;
  create(data: CreateSubscriptionData): Promise<Subscription>;
  updateStatus(id: string, status: SubscriptionStatus): Promise<Subscription>;
  update(id: string, data: UpdateSubscriptionData): Promise<Subscription>;
}
```

---

## Fase 5: Repository Layer

> **Dependencias:** Fase 4

### 5.1 PlanRepository

Archivo: `src/core/infrastructure/database/repositories/plan.repository.ts`

- Implementa `IPlanRepository`
- Usa `PrismaClient` inyectado
- Mapea a entidad `Plan` con `Plan.fromPrisma()`

### 5.2 SubscriptionRepository

Archivo: `src/core/infrastructure/database/repositories/subscription.repository.ts`

- Implementa `ISubscriptionRepository`
- Incluye relaciones (`plan`, `company`) en queries cuando sea necesario
- Maneja actualizaciones parciales para webhooks

### 5.3 SubscriptionInvoiceRepository

Archivo: `src/core/infrastructure/database/repositories/subscription-invoice.repository.ts`

- `create(data)` - Crear registro de invoice
- `findBySubscriptionId(id)` - Historial de invoices
- `findByStripeInvoiceId(id)` - Buscar por ID de Stripe

---

## Fase 6: Use Cases

> **Dependencias:** Fases 3, 4, 5

### 6.1 `CreateCheckoutSession` (Iniciar subscripcion)

Archivo: `src/core/application/use-cases/subscriptions/create-checkout-session.use-case.ts`

**Flujo:**
1. Validar que la company no tenga subscripcion activa
2. Buscar o crear Stripe Customer (`stripeCustomerId`)
3. Crear Checkout Session en Stripe con el `priceId` del plan seleccionado
4. Crear registro de `Subscription` con status `INCOMPLETE`
5. Retornar `checkoutUrl` para redirigir al usuario

### 6.2 `CancelSubscription`

Archivo: `src/core/application/use-cases/subscriptions/cancel-subscription.use-case.ts`

**Flujo:**
1. Buscar subscripcion activa de la company
2. Llamar a `stripeService.cancelSubscription(id, cancelAtPeriodEnd: true)`
3. Actualizar `cancelAtPeriodEnd = true` en BD
4. Retornar fecha de fin de periodo

### 6.3 `GetSubscriptionStatus`

Archivo: `src/core/application/use-cases/subscriptions/get-subscription-status.use-case.ts`

**Flujo:**
1. Buscar subscripcion de la company (incluir plan)
2. Retornar status, plan actual, periodo actual, si esta por cancelarse

### 6.4 `ChangePlan`

Archivo: `src/core/application/use-cases/subscriptions/change-plan.use-case.ts`

**Flujo:**
1. Validar que existe subscripcion activa
2. Obtener nuevo plan y su `stripePriceId`
3. Llamar a `stripeService.updateSubscription()` con nuevo price
4. Stripe prorratea automaticamente
5. Actualizar `planId` en BD

### 6.5 `CreateBillingPortalSession`

Archivo: `src/core/application/use-cases/subscriptions/create-billing-portal-session.use-case.ts`

**Flujo:**
1. Buscar subscripcion de la company
2. Crear Billing Portal Session en Stripe
3. Retornar URL del portal (para gestionar metodo de pago, invoices, etc.)

### 6.6 `GetSubscriptionInvoices`

Archivo: `src/core/application/use-cases/subscriptions/get-subscription-invoices.use-case.ts`

**Flujo:**
1. Buscar subscripcion de la company
2. Retornar historial de invoices con paginacion

### 6.7 `ListPlans`

Archivo: `src/core/application/use-cases/subscriptions/list-plans.use-case.ts`

**Flujo:**
1. Retornar todos los planes activos

---

## Fase 7: Webhook Handler

> **Dependencias:** Fases 3, 5, 6

### 7.1 Handler principal de webhooks

Archivo: `src/handlers/subscriptions/stripe-webhook.handler.ts`

**Eventos a manejar:**

| Evento Stripe                          | Accion                                                    |
|----------------------------------------|-----------------------------------------------------------|
| `checkout.session.completed`           | Activar subscripcion, guardar `stripeSubscriptionId`      |
| `invoice.paid`                         | Actualizar periodo, crear `SubscriptionInvoice`           |
| `invoice.payment_failed`              | Cambiar status a `PAST_DUE`                               |
| `customer.subscription.updated`        | Sincronizar cambios (plan, status, periodo)               |
| `customer.subscription.deleted`        | Marcar como `CANCELED`                                    |

### 7.2 Estructura del webhook handler

```typescript
const stripeWebhookHandlerBase = async (event: APIGatewayProxyEvent): Promise<any> => {
  const stripeService = container.resolve(StripeService);

  // 1. Verificar firma del webhook
  const stripeEvent = stripeService.constructWebhookEvent(
    event.body!,
    event.headers['stripe-signature']!,
  );

  // 2. Rutear por tipo de evento
  switch (stripeEvent.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(stripeEvent.data.object);
      break;
    case 'invoice.paid':
      await handleInvoicePaid(stripeEvent.data.object);
      break;
    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(stripeEvent.data.object);
      break;
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(stripeEvent.data.object);
      break;
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(stripeEvent.data.object);
      break;
    default:
      console.log(`Evento no manejado: ${stripeEvent.type}`);
  }

  return { received: true };
};
```

> **Importante:** El webhook handler NO debe usar `httpJsonBodyParser` ya que necesita el body raw para verificar la firma de Stripe.

### 7.3 Idempotencia

- Usar `stripeEvent.id` para evitar procesamiento duplicado
- Verificar estado actual antes de actualizar (evitar regresiones de estado)
- Considerar tabla `ProcessedWebhookEvent` o check de estado en `Subscription`

---

## Fase 8: Handlers (API Endpoints)

> **Dependencias:** Fase 6

### 8.1 Endpoints

| Metodo | Ruta                              | Handler                        | Descripcion                    |
|--------|-----------------------------------|--------------------------------|--------------------------------|
| POST   | `/subscriptions/checkout`         | createCheckoutSessionHandler   | Iniciar proceso de subscripcion|
| GET    | `/subscriptions/status`           | getSubscriptionStatusHandler   | Estado actual de subscripcion  |
| POST   | `/subscriptions/cancel`           | cancelSubscriptionHandler      | Cancelar subscripcion          |
| POST   | `/subscriptions/change-plan`      | changePlanHandler              | Cambiar de plan                |
| POST   | `/subscriptions/billing-portal`   | createBillingPortalHandler     | Acceso al portal de Stripe     |
| GET    | `/subscriptions/invoices`         | getSubscriptionInvoicesHandler | Historial de facturas          |
| GET    | `/plans`                          | listPlansHandler               | Listar planes disponibles      |
| POST   | `/webhooks/stripe-subscription`   | stripeWebhookHandler           | Recibir webhooks de Stripe     |

### 8.2 DTOs (Zod Schemas)

Archivo: `src/core/application/dto/subscription.dto.ts`

```typescript
export const createCheckoutSessionSchema = z.object({
  planId: z.string().uuid(),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

export const cancelSubscriptionSchema = z.object({
  companyId: z.string().uuid(),
});

export const changePlanSchema = z.object({
  companyId: z.string().uuid(),
  newPlanId: z.string().uuid(),
});

export const getSubscriptionInvoicesSchema = z.object({
  companyId: z.string().uuid(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(10),
});
```

---

## Fase 9: Middleware de verificacion de subscripcion

> **Dependencias:** Fases 5, 6

### 9.1 Middleware `subscriptionGuard`

Archivo: `src/shared/middleware/subscription-guard.middleware.ts`

Middleware de Middy que verifica si la company tiene subscripcion activa antes de permitir acceso a endpoints protegidos.

```typescript
export const subscriptionGuard = (): middy.MiddlewareObj => {
  const before: middy.MiddlewareFn = async (request) => {
    const companyId = extractCompanyId(request.event);
    const subscriptionRepo = container.resolve<ISubscriptionRepository>('ISubscriptionRepository');
    const subscription = await subscriptionRepo.findByCompanyId(companyId);

    if (!subscription || !subscription.canAccess()) {
      throw new AppError('SUBSCRIPTION_REQUIRED');
    }

    // Adjuntar al evento para uso en el handler
    request.event.subscription = subscription;
  };

  return { before };
};
```

### 9.2 Uso en handlers protegidos

```typescript
middy(baseHandler)
  .use(httpEventNormalizer())
  .use(httpJsonBodyParser())
  .use(authMiddleware())
  .use(subscriptionGuard())  // <-- Verificar subscripcion despues de auth
  .use(zodValidator({ schema }))
  .use(customErrorHandler())
  .use(responseFormatter());
```

### 9.3 Periodo de gracia

- Status `PAST_DUE`: Permitir acceso por X dias (configurable)
- Status `UNPAID` o `CANCELED`: Bloquear acceso
- Considerar mostrar banner de advertencia en el frontend (futura fase)

---

## Fase 10: Registro en DI Container

> **Dependencias:** Fases 3, 5, 6

### 10.1 Actualizar `dependency-injection.ts`

```typescript
// Repositories
container.register<IPlanRepository>('IPlanRepository', {
  useFactory: () => new PlanRepository(prismaClient),
});
container.register<ISubscriptionRepository>('ISubscriptionRepository', {
  useFactory: () => new SubscriptionRepository(prismaClient),
});
container.register<ISubscriptionInvoiceRepository>('ISubscriptionInvoiceRepository', {
  useFactory: () => new SubscriptionInvoiceRepository(prismaClient),
});

// Use Cases
container.register(CreateCheckoutSessionUseCase, CreateCheckoutSessionUseCase);
container.register(CancelSubscriptionUseCase, CancelSubscriptionUseCase);
container.register(GetSubscriptionStatusUseCase, GetSubscriptionStatusUseCase);
container.register(ChangePlanUseCase, ChangePlanUseCase);
container.register(CreateBillingPortalSessionUseCase, CreateBillingPortalSessionUseCase);
container.register(GetSubscriptionInvoicesUseCase, GetSubscriptionInvoicesUseCase);
container.register(ListPlansUseCase, ListPlansUseCase);
```

---

## Fase 11: Serverless / Rutas

> **Dependencias:** Fase 8

### 11.1 serverless.yml

Agregar funciones Lambda para cada handler:

```yaml
# Subscriptions
createCheckoutSession:
  handler: src/handlers/subscriptions/create-checkout-session.handler.createCheckoutSessionHandler
  events:
    - http:
        path: subscriptions/checkout
        method: post
        authorizer: ${self:custom.authorizer}

getSubscriptionStatus:
  handler: src/handlers/subscriptions/get-subscription-status.handler.getSubscriptionStatusHandler
  events:
    - http:
        path: subscriptions/status
        method: get
        authorizer: ${self:custom.authorizer}

cancelSubscription:
  handler: src/handlers/subscriptions/cancel-subscription.handler.cancelSubscriptionHandler
  events:
    - http:
        path: subscriptions/cancel
        method: post
        authorizer: ${self:custom.authorizer}

changePlan:
  handler: src/handlers/subscriptions/change-plan.handler.changePlanHandler
  events:
    - http:
        path: subscriptions/change-plan
        method: post
        authorizer: ${self:custom.authorizer}

createBillingPortal:
  handler: src/handlers/subscriptions/create-billing-portal.handler.createBillingPortalHandler
  events:
    - http:
        path: subscriptions/billing-portal
        method: post
        authorizer: ${self:custom.authorizer}

getSubscriptionInvoices:
  handler: src/handlers/subscriptions/get-subscription-invoices.handler.getSubscriptionInvoicesHandler
  events:
    - http:
        path: subscriptions/invoices
        method: get
        authorizer: ${self:custom.authorizer}

listPlans:
  handler: src/handlers/subscriptions/list-plans.handler.listPlansHandler
  events:
    - http:
        path: plans
        method: get
        # Sin authorizer - endpoint publico

stripeSubscriptionWebhook:
  handler: src/handlers/subscriptions/stripe-webhook.handler.stripeWebhookHandler
  events:
    - http:
        path: webhooks/stripe-subscription
        method: post
        # Sin authorizer - Stripe envia directamente
```

### 11.2 Express routes (desarrollo local)

Archivo: `src/server/routes/subscription.routes.ts`

```typescript
router.post('/subscriptions/checkout', adaptHandler(createCheckoutSessionHandler));
router.get('/subscriptions/status', adaptHandler(getSubscriptionStatusHandler));
router.post('/subscriptions/cancel', adaptHandler(cancelSubscriptionHandler));
router.post('/subscriptions/change-plan', adaptHandler(changePlanHandler));
router.post('/subscriptions/billing-portal', adaptHandler(createBillingPortalHandler));
router.get('/subscriptions/invoices', adaptHandler(getSubscriptionInvoicesHandler));
router.get('/plans', adaptHandler(listPlansHandler));
router.post('/webhooks/stripe-subscription', adaptHandler(stripeWebhookHandler));
```

---

## Fase 12: Variables de entorno

> **Dependencias:** Ninguna

### 12.1 Variables necesarias

```env
# Stripe (ya existentes)
STRIPE_SECRET_KEY=sk_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Stripe Subscriptions (nuevas)
STRIPE_SUBSCRIPTION_WEBHOOK_SECRET=whsec_xxx    # Webhook secret especifico para subscripciones
STRIPE_BILLING_PORTAL_RETURN_URL=https://app.restify.com/settings/billing

# Subscripcion
SUBSCRIPTION_GRACE_PERIOD_DAYS=7                 # Dias de gracia en PAST_DUE
```

---

## Fase 13: Testing

> **Dependencias:** Todas las fases anteriores

### 13.1 Tests unitarios

- Use cases: mockear repositories y StripeService
- Entidades: probar metodos de dominio (`isActive()`, `canAccess()`)
- Middleware: probar `subscriptionGuard` con diferentes estados

### 13.2 Tests de integracion

- Repositorios contra BD de prueba
- Webhook handler con eventos simulados de Stripe
- Flujo completo: checkout -> webhook -> status

### 13.3 Tests E2E con Stripe CLI

```bash
# Escuchar webhooks localmente
stripe listen --forward-to localhost:3000/webhooks/stripe-subscription

# Trigger eventos de prueba
stripe trigger checkout.session.completed
stripe trigger invoice.paid
stripe trigger invoice.payment_failed
stripe trigger customer.subscription.deleted
```

---

## Orden de implementacion recomendado

```
Fase 1  → Modelo de datos (Prisma schema + migracion)
Fase 12 → Variables de entorno
Fase 2  → Seed de planes
Fase 4  → Domain layer (entidades + interfaces)
Fase 3  → Extender StripeService
Fase 5  → Repository layer
Fase 10 → Registro en DI
Fase 6  → Use Cases
Fase 8  → Handlers + DTOs
Fase 7  → Webhook handler
Fase 9  → Middleware subscriptionGuard
Fase 11 → Serverless + Express routes
Fase 13 → Testing
```

---

## Consideraciones adicionales

### Seguridad
- Validar firma de webhooks siempre (`constructWebhookEvent`)
- No exponer `stripeCustomerId` en respuestas publicas
- Solo ADMIN puede gestionar subscripciones
- Rate limiting en endpoints de checkout

### Idempotencia
- Webhooks pueden llegar duplicados: usar `stripeEvent.id` o verificar estado actual
- Checkout Session puede completarse multiples veces: verificar si ya existe subscripcion activa

### Monitoreo
- Log de todos los eventos de webhook recibidos
- Alertas para pagos fallidos (`PAST_DUE`)
- Dashboard de subscripciones activas vs canceladas

### Escalabilidad futura
- Trial periods (`TRIALING` status ya definido)
- Cupones/descuentos (Stripe Coupons API)
- Planes anuales (enum `YEARLY` ya definido)
- Multiples subscripciones por company (remover `@@unique([companyId])`)
- Metered billing (uso por transaccion)
