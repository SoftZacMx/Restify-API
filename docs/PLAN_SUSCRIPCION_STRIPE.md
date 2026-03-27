# Plan de Implementación - Suscripción Mensual con Stripe (Backend)

## Objetivo

Cobrar automáticamente una mensualidad a cada negocio/restaurante que usa Restify. El usuario se suscribe una vez, Stripe cobra cada mes. Si el pago falla o la suscripción vence, el sistema bloquea el acceso hasta que se regularice.

> **Contexto:** Cada negocio tiene su propia base de datos. No hay multi-tenancy. No se necesita Stripe Connect ni split de pagos. Un solo plan, un solo precio.

---

## Contexto técnico actual

- **Stripe** ya está instalado (`stripe` npm package) y configurado con `StripeService`
- `STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET` ya existen en `.env`
- Arquitectura: Use Cases + Repositories + Handlers (Middy) + DI (tsyringe)
- Base de datos: MySQL con Prisma ORM
- Auth: JWT con middleware `AuthMiddleware.authenticate`
- No existe modelo de suscripción actualmente

---

## Decisiones de diseño

| Tema | Decisión | Razón |
|------|----------|-------|
| Producto Stripe | **Stripe Checkout + Subscriptions** | Stripe maneja la UI de pago, cobro recurrente, reintentos y tarjetas |
| Planes | Un solo plan mensual (precio fijo en MXN) | Simplicidad, un solo tier |
| Cobro | Automático cada mes por Stripe | Sin cron jobs ni lógica de reintentos propia |
| UI de pago | Redirect a Stripe Checkout | No necesitamos Stripe Elements, Checkout es más simple y seguro |
| Bloqueo | Middleware que valida vigencia en cada request | Si la suscripción no está activa, retorna 403 |
| Cancelación | El usuario puede cancelar, se mantiene acceso hasta fin del período | Comportamiento estándar de SaaS |
| Trial | Opcional — 14 días gratis configurable | Se puede activar o no al crear la suscripción |

---

## Flujo general

```
1. Admin del negocio entra a Restify por primera vez (o su suscripción venció)
2. Ve pantalla de "Suscríbete para continuar"
3. Hace clic en "Suscribirse" → backend crea Stripe Customer + Checkout Session
4. Se redirige a Stripe Checkout → ingresa tarjeta y paga
5. Stripe procesa el pago → envía webhook `checkout.session.completed`
6. Backend crea/activa registro Subscription en BD
7. Cada mes Stripe cobra automáticamente:
   a. Si pago exitoso → webhook `invoice.paid` → se extiende currentPeriodEnd
   b. Si pago falla → webhook `invoice.payment_failed` → se marca como PAST_DUE
8. Si el usuario cancela → webhook `customer.subscription.deleted` → status = CANCELED
9. Middleware en cada request valida que la suscripción esté activa
```

---

## Fase 0: Configuración en Dashboard de Stripe (Manual, una sola vez)

> **Dependencias:** Ninguna. Prerrequisito para todo lo demás.

### 0.1 Crear Producto en Stripe Dashboard

1. Ir a https://dashboard.stripe.com/test/products
2. Crear producto:
   - Nombre: "Restify - Plan Mensual"
   - Descripción: "Suscripción mensual al sistema Restify para restaurantes"
3. Crear precio:
   - Monto: $XXX MXN/mes (definir precio)
   - Moneda: MXN
   - Recurrencia: Mensual
4. Copiar el `price_id` (ej: `price_1Abc123...`)

### 0.2 Configurar webhook de Stripe

#### En local (desarrollo):

```bash
# Instalar Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Reenviar webhooks a tu servidor local
stripe listen --forward-to localhost:3000/api/webhooks/stripe-subscription
```

La CLI imprime un signing secret temporal (`whsec_xxx`) — usarlo en `.env` como `STRIPE_SUBSCRIPTION_WEBHOOK_SECRET`.

Para disparar eventos de prueba:
```bash
stripe trigger checkout.session.completed
stripe trigger invoice.payment_succeeded
stripe trigger invoice.payment_failed
stripe trigger customer.subscription.deleted
```

#### En produccion:

1. Ir a https://dashboard.stripe.com/test/webhooks (test) o /webhooks (live)
2. Agregar endpoint: `https://<TU_DOMINIO>/api/webhooks/stripe-subscription`
3. Seleccionar eventos:
   - `checkout.session.completed`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copiar el `webhook signing secret`

### 0.3 Variables de entorno

Agregar a `.env`:

```env
# Stripe Subscription
STRIPE_PRICE_ID="price_xxx"                    # Price ID del plan mensual
STRIPE_SUBSCRIPTION_WEBHOOK_SECRET="whsec_xxx" # Local: el que da stripe listen / Prod: el del Dashboard

# Estas se agregan cuando se integre el frontend (no necesarias para backend):
# STRIPE_SUCCESS_URL="http://localhost:5173/subscription/success"   # Local
# STRIPE_CANCEL_URL="http://localhost:5173/subscription/cancel"     # Local
```

---

## Fase 1: Modelo de datos

> **Dependencias:** Ninguna.

### 1.1 Agregar enums

```prisma
enum SubscriptionStatus {
  ACTIVE          // Suscripción activa, pago al día
  PAST_DUE        // Pago falló, en período de gracia
  CANCELED        // Cancelada por el usuario
  EXPIRED         // Venció sin renovación
  TRIALING        // En período de prueba (opcional)
}
```

### 1.2 Crear modelo Subscription

```prisma
model Subscription {
  id                     String             @id @default(uuid())
  stripeCustomerId       String             @unique  // Stripe Customer ID
  stripeSubscriptionId   String?            @unique  // Stripe Subscription ID
  status                 SubscriptionStatus @default(EXPIRED)
  currentPeriodStart     DateTime?          // Inicio del período actual
  currentPeriodEnd       DateTime?          // Fin del período actual
  cancelAtPeriodEnd      Boolean            @default(false) // Cancelará al final del período
  createdAt              DateTime           @default(now())
  updatedAt              DateTime           @updatedAt

  @@map("subscriptions")
}
```

> **Nota:** No hay relación con `User` porque solo hay un registro de suscripción por base de datos (un negocio = una BD = una suscripción).

### 1.3 Migración

```bash
npx prisma migrate dev --name add-subscription-model
```

---

## Fase 2: StripeSubscriptionService

> **Dependencias:** Fases 0, 1

### 2.1 Crear servicio

Archivo: `src/core/infrastructure/payment-gateways/stripe-subscription.service.ts`

Separar del `StripeService` existente (ese es para pagos de órdenes). Este es específico para suscripciones.

```typescript
@injectable()
export class StripeSubscriptionService {
  private stripe: Stripe;

  constructor() {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }
    this.stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });
  }
}
```

### 2.2 Métodos del servicio

```typescript
/**
 * Crea un Customer en Stripe (una vez por negocio).
 */
async createCustomer(params: CreateCustomerParams): Promise<string>; // retorna customerId

/**
 * Crea una Checkout Session para suscripción.
 * Retorna URL a la que se redirige al usuario.
 */
async createCheckoutSession(params: CreateCheckoutSessionParams): Promise<CheckoutSessionResult>;

/**
 * Obtiene el estado actual de una suscripción en Stripe.
 */
async getSubscription(subscriptionId: string): Promise<StripeSubscriptionResult>;

/**
 * Cancela la suscripción al final del período actual.
 */
async cancelSubscription(subscriptionId: string): Promise<void>;

/**
 * Reactiva una suscripción cancelada (si aún no venció).
 */
async reactivateSubscription(subscriptionId: string): Promise<void>;

/**
 * Valida la firma del webhook de Stripe.
 */
constructWebhookEvent(payload: string, signature: string): Stripe.Event;
```

### 2.3 Interfaces

```typescript
export interface CreateCustomerParams {
  email: string;
  name: string;          // Nombre del negocio
  metadata?: Record<string, string>;
}

export interface CreateCheckoutSessionParams {
  customerId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  trialDays?: number;    // Opcional: días de prueba gratis
}

export interface CheckoutSessionResult {
  sessionId: string;
  url: string;           // URL de Stripe Checkout para redirect
}

export interface StripeSubscriptionResult {
  id: string;
  status: string;        // "active", "past_due", "canceled", "trialing", etc.
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
}
```

### 2.4 Implementación de createCheckoutSession

```typescript
async createCheckoutSession(params: CreateCheckoutSessionParams): Promise<CheckoutSessionResult> {
  const sessionConfig: Stripe.Checkout.SessionCreateParams = {
    customer: params.customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: params.priceId,
        quantity: 1,
      },
    ],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  };

  if (params.trialDays) {
    sessionConfig.subscription_data = {
      trial_period_days: params.trialDays,
    };
  }

  const session = await this.stripe.checkout.sessions.create(sessionConfig);

  return {
    sessionId: session.id,
    url: session.url!,
  };
}
```

### 2.5 Implementación de constructWebhookEvent

```typescript
constructWebhookEvent(payload: string, signature: string): Stripe.Event {
  const secret = process.env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('STRIPE_SUBSCRIPTION_WEBHOOK_SECRET is required');
  }
  return this.stripe.webhooks.constructEvent(payload, signature, secret);
}
```

---

## Fase 3: Subscription Repository

> **Dependencias:** Fase 1

### 3.1 Interfaz

Archivo: `src/core/domain/interfaces/subscription-repository.interface.ts`

```typescript
export interface ISubscriptionRepository {
  find(): Promise<Subscription | null>;           // Solo hay una por BD
  create(data: CreateSubscriptionData): Promise<Subscription>;
  update(id: string, data: UpdateSubscriptionData): Promise<Subscription>;
}
```

> **Nota:** `find()` sin parámetros porque solo existe un registro de suscripción por base de datos.

### 3.2 Entidad

Archivo: `src/core/domain/entities/subscription.entity.ts`

```typescript
export class Subscription {
  constructor(
    public readonly id: string,
    public readonly stripeCustomerId: string,
    public readonly stripeSubscriptionId: string | null,
    public readonly status: SubscriptionStatus,
    public readonly currentPeriodStart: Date | null,
    public readonly currentPeriodEnd: Date | null,
    public readonly cancelAtPeriodEnd: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}
}
```

### 3.3 Implementación del repository

Archivo: `src/core/infrastructure/database/repositories/subscription.repository.ts`

Seguir el mismo patrón que los repositorios existentes (PrismaClient inyectado).

---

## Fase 4: Use Cases

> **Dependencias:** Fases 2, 3

### 4.1 `CreateSubscriptionCheckout` — Iniciar suscripción

Archivo: `src/core/application/use-cases/subscription/create-subscription-checkout.use-case.ts`

**Input:**
```typescript
interface CreateSubscriptionCheckoutInput {
  email: string;
  businessName: string;
}
```

**Flujo:**
1. Buscar suscripción existente en BD (`subscriptionRepository.find()`)
2. Si ya existe con status `ACTIVE` → error `SUBSCRIPTION_ALREADY_ACTIVE`
3. Si existe y tiene `stripeCustomerId` → reutilizar. Si no → crear Customer en Stripe
4. Crear Checkout Session con el `priceId` del `.env`
5. Si no existía registro en BD → crear Subscription con status `EXPIRED` y `stripeCustomerId`
6. Retornar `{ checkoutUrl }` para redirect

**Output:**
```typescript
interface CreateSubscriptionCheckoutResult {
  checkoutUrl: string;
  sessionId: string;
}
```

### 4.2 `HandleSubscriptionWebhook` — Procesar webhooks de Stripe

Archivo: `src/core/application/use-cases/subscription/handle-subscription-webhook.use-case.ts`

**Input:**
```typescript
interface HandleSubscriptionWebhookInput {
  event: Stripe.Event;
}
```

**Flujo por tipo de evento:**

#### `checkout.session.completed`
1. Extraer `customer` y `subscription` del evento
2. Buscar Subscription en BD por `stripeCustomerId`
3. Actualizar: `stripeSubscriptionId`, `status = ACTIVE`, `currentPeriodStart`, `currentPeriodEnd`

#### `invoice.paid`
1. Extraer `subscription` del invoice
2. Buscar Subscription por `stripeSubscriptionId`
3. Actualizar: `status = ACTIVE`, extender `currentPeriodEnd` al nuevo período

#### `invoice.payment_failed`
1. Buscar Subscription por `stripeSubscriptionId`
2. Actualizar: `status = PAST_DUE`

#### `customer.subscription.updated`
1. Buscar Subscription por `stripeSubscriptionId`
2. Actualizar `cancelAtPeriodEnd`, `status`, `currentPeriodEnd` según datos del evento

#### `customer.subscription.deleted`
1. Buscar Subscription por `stripeSubscriptionId`
2. Actualizar: `status = CANCELED`

### 4.3 `GetSubscriptionStatus` — Consultar estado

Archivo: `src/core/application/use-cases/subscription/get-subscription-status.use-case.ts`

**Flujo:**
1. Buscar Subscription en BD
2. Si no existe → retornar `{ exists: false, status: null }`
3. Si existe → retornar status, fechas, si está por cancelarse

**Output:**
```typescript
interface GetSubscriptionStatusResult {
  exists: boolean;
  status: SubscriptionStatus | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  isActive: boolean;            // Helper: status === ACTIVE || TRIALING
  daysRemaining: number | null; // Días hasta que vence
}
```

### 4.4 `CancelSubscription` — Cancelar suscripción

Archivo: `src/core/application/use-cases/subscription/cancel-subscription.use-case.ts`

**Flujo:**
1. Buscar Subscription en BD
2. Validar que existe y tiene `stripeSubscriptionId`
3. Llamar `stripeSubscriptionService.cancelSubscription()` (cancel at period end)
4. Actualizar BD: `cancelAtPeriodEnd = true`

### 4.5 `ReactivateSubscription` — Reactivar suscripción cancelada

Archivo: `src/core/application/use-cases/subscription/reactivate-subscription.use-case.ts`

**Flujo:**
1. Buscar Subscription en BD
2. Validar que `cancelAtPeriodEnd === true` y `status === ACTIVE` (aún no venció)
3. Llamar `stripeSubscriptionService.reactivateSubscription()`
4. Actualizar BD: `cancelAtPeriodEnd = false`

---

## Fase 5: Middleware de vigencia

> **Dependencias:** Fase 3

### 5.1 Crear SubscriptionMiddleware

Archivo: `src/server/middleware/subscription.middleware.ts`

```typescript
export class SubscriptionMiddleware {
  static async validateSubscription(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const prismaService = container.resolve(PrismaService);
    const prismaClient = prismaService.getClient();

    const subscription = await prismaClient.subscription.findFirst();

    if (!subscription) {
      res.status(403).json({
        success: false,
        error: {
          code: 'SUBSCRIPTION_REQUIRED',
          message: 'Se requiere una suscripción activa para usar el sistema',
        },
      });
      return;
    }

    const now = new Date();
    const isActive =
      (subscription.status === 'ACTIVE' || subscription.status === 'TRIALING') &&
      subscription.currentPeriodEnd &&
      subscription.currentPeriodEnd > now;

    // Período de gracia: 3 días después de vencimiento para PAST_DUE
    const gracePeriodMs = 3 * 24 * 60 * 60 * 1000;
    const isPastDueWithGrace =
      subscription.status === 'PAST_DUE' &&
      subscription.currentPeriodEnd &&
      new Date(subscription.currentPeriodEnd.getTime() + gracePeriodMs) > now;

    if (!isActive && !isPastDueWithGrace) {
      res.status(403).json({
        success: false,
        error: {
          code: 'SUBSCRIPTION_EXPIRED',
          message: 'Tu suscripción ha vencido. Renueva para continuar usando el sistema.',
        },
      });
      return;
    }

    next();
  }
}
```

### 5.2 Aplicar middleware en rutas

En `src/server/routes/index.ts`, aplicar **después** de auth pero **antes** de las rutas de negocio:

```typescript
// Rutas SIN validación de suscripción (siempre accesibles)
router.use('/health', healthRoutes);
router.use('/api/auth', authRoutes);
router.use('/api/subscription', subscriptionRoutes);  // Para poder suscribirse
router.use('/webhooks', webhookRoutes);                // Webhooks de Stripe/MP

// Rutas CON validación de suscripción
router.use(SubscriptionMiddleware.validateSubscription);
router.use('/api/company', companyRoutes);
router.use('/api/users', userRoutes);
router.use('/api/products', productRoutes);
// ... resto de rutas
```

> **Importante:** Las rutas de auth, suscripción y webhooks NO pasan por este middleware. El usuario necesita poder autenticarse y suscribirse sin tener suscripción activa.

---

## Fase 6: Webhook Handler

> **Dependencias:** Fases 2, 4

### 6.1 Handler

Archivo: `src/handlers/subscription/stripe-subscription-webhook.handler.ts`

```typescript
const stripeSubscriptionWebhookHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  const service = container.resolve(StripeSubscriptionService);

  // Body raw para validar firma
  const payload = typeof event.body === 'string' ? event.body : JSON.stringify(event.body);
  const signature = event.headers['stripe-signature'] || event.headers['Stripe-Signature'] || '';

  const stripeEvent = service.constructWebhookEvent(payload, signature);

  const useCase = container.resolve(HandleSubscriptionWebhookUseCase);
  await useCase.execute({ event: stripeEvent });

  return { received: true };
};

// Sin httpJsonBodyParser — body raw para validar firma
export const stripeSubscriptionWebhookHandler = middy(stripeSubscriptionWebhookHandlerBase)
  .use(httpEventNormalizer())
  .use(customErrorHandler())
  .use(responseFormatter());
```

---

## Fase 7: Handlers (API Endpoints)

> **Dependencias:** Fase 4

### 7.1 Endpoints

| Método | Ruta | Handler | Auth | Descripción |
|--------|------|---------|------|-------------|
| POST | `/api/subscription/checkout` | createSubscriptionCheckoutHandler | Sí | Generar URL de Checkout |
| GET | `/api/subscription/status` | getSubscriptionStatusHandler | Sí | Consultar estado |
| POST | `/api/subscription/cancel` | cancelSubscriptionHandler | Sí | Cancelar al fin del período |
| POST | `/api/subscription/reactivate` | reactivateSubscriptionHandler | Sí | Reactivar cancelación |
| POST | `/webhooks/stripe-subscription` | stripeSubscriptionWebhookHandler | No | Webhook de Stripe |

### 7.2 DTOs (Zod Schemas)

Archivo: `src/core/application/dto/subscription.dto.ts`

```typescript
export const createSubscriptionCheckoutSchema = z.object({
  email: z.string().email(),
  businessName: z.string().min(1).max(200),
});

export const cancelSubscriptionSchema = z.object({});  // No requiere input

export const reactivateSubscriptionSchema = z.object({}); // No requiere input
```

---

## Fase 8: Registro en DI + Rutas Express

> **Dependencias:** Fases 2, 3, 4

### 8.1 Actualizar dependency-injection.ts

```typescript
// Subscription
import { StripeSubscriptionService } from '../payment-gateways/stripe-subscription.service';
import { SubscriptionRepository } from '../database/repositories/subscription.repository';
import { CreateSubscriptionCheckoutUseCase } from '../../application/use-cases/subscription/create-subscription-checkout.use-case';
import { HandleSubscriptionWebhookUseCase } from '../../application/use-cases/subscription/handle-subscription-webhook.use-case';
import { GetSubscriptionStatusUseCase } from '../../application/use-cases/subscription/get-subscription-status.use-case';
import { CancelSubscriptionUseCase } from '../../application/use-cases/subscription/cancel-subscription.use-case';
import { ReactivateSubscriptionUseCase } from '../../application/use-cases/subscription/reactivate-subscription.use-case';

container.registerSingleton(StripeSubscriptionService);
container.register<ISubscriptionRepository>('ISubscriptionRepository', {
  useFactory: () => new SubscriptionRepository(prismaClient),
});
container.register(CreateSubscriptionCheckoutUseCase, CreateSubscriptionCheckoutUseCase);
container.register(HandleSubscriptionWebhookUseCase, HandleSubscriptionWebhookUseCase);
container.register(GetSubscriptionStatusUseCase, GetSubscriptionStatusUseCase);
container.register(CancelSubscriptionUseCase, CancelSubscriptionUseCase);
container.register(ReactivateSubscriptionUseCase, ReactivateSubscriptionUseCase);
```

### 8.2 Crear subscription.routes.ts

```typescript
const router = Router();

// Webhook sin auth (Stripe envía directamente)
router.post('/webhooks/stripe-subscription', async (req, res) => { ... });

// Rutas con auth
router.use(AuthMiddleware.authenticate);
router.post('/checkout', async (req, res) => { ... });
router.get('/status', async (req, res) => { ... });
router.post('/cancel', async (req, res) => { ... });
router.post('/reactivate', async (req, res) => { ... });
```

### 8.3 Registrar en index.ts

```typescript
import subscriptionRoutes from './subscription.routes';

// ANTES del SubscriptionMiddleware
router.use('/api/subscription', subscriptionRoutes);
```

---

## Fase 9: Error codes

> **Dependencias:** Ninguna

Agregar a `error-config.ts`:

```typescript
SUBSCRIPTION_REQUIRED: {
  message: 'Se requiere una suscripción activa',
  statusCode: 403,
  category: 'BUSINESS',
},
SUBSCRIPTION_EXPIRED: {
  message: 'Tu suscripción ha vencido',
  statusCode: 403,
  category: 'BUSINESS',
},
SUBSCRIPTION_ALREADY_ACTIVE: {
  message: 'Ya tienes una suscripción activa',
  statusCode: 400,
  category: 'BUSINESS',
},
SUBSCRIPTION_NOT_FOUND: {
  message: 'No se encontró suscripción',
  statusCode: 404,
  category: 'BUSINESS',
},
SUBSCRIPTION_CANNOT_CANCEL: {
  message: 'No se puede cancelar la suscripción',
  statusCode: 400,
  category: 'BUSINESS',
},
SUBSCRIPTION_CANNOT_REACTIVATE: {
  message: 'No se puede reactivar la suscripción',
  statusCode: 400,
  category: 'BUSINESS',
},
```

---

## Fase 10: Testing

> **Dependencias:** Todas las fases anteriores

### 10.1 Tests unitarios

- `StripeSubscriptionService`: mockear SDK de Stripe (createCustomer, createCheckoutSession, cancelSubscription)
- `CreateSubscriptionCheckoutUseCase`: mockear service + repository
- `HandleSubscriptionWebhookUseCase`: probar cada tipo de evento (checkout.session.completed, invoice.paid, invoice.payment_failed, customer.subscription.deleted)
- `GetSubscriptionStatusUseCase`: probar cálculo de daysRemaining e isActive
- `CancelSubscriptionUseCase`: probar validaciones
- `SubscriptionMiddleware`: probar acceso permitido/bloqueado según estado

### 10.2 Tests de integración

- Flujo completo: crear checkout → webhook completed → suscripción activa
- Renovación: webhook invoice.paid → periodo extendido
- Fallo de pago: webhook invoice.payment_failed → status PAST_DUE
- Cancelación: cancel → webhook deleted → status CANCELED
- Middleware: request con suscripción activa pasa, sin suscripción retorna 403

### 10.3 Testing con Stripe Test Mode

```
1. Usar STRIPE_SECRET_KEY en modo test (sk_test_...)
2. Crear Checkout Session con token de test
3. Usar tarjetas de prueba de Stripe:
   - 4242 4242 4242 4242 (pago exitoso)
   - 4000 0000 0000 0341 (pago rechazado)
   - 4000 0000 0000 3220 (requiere autenticación 3DS)
4. Usar Stripe CLI para probar webhooks localmente:
   stripe listen --forward-to localhost:3000/webhooks/stripe-subscription
5. Trigger eventos de prueba:
   stripe trigger checkout.session.completed
   stripe trigger invoice.paid
   stripe trigger invoice.payment_failed
```

---

## Orden de implementación recomendado

```
Fase 0  → Configuración en Stripe Dashboard (manual)
Fase 1  → Modelo de datos (Subscription en Prisma + migración)
Fase 9  → Error codes
Fase 3  → Subscription Repository + Entidad
Fase 2  → StripeSubscriptionService
Fase 4  → Use Cases
Fase 5  → Middleware de vigencia
Fase 6  → Webhook Handler
Fase 7  → Handlers + DTOs
Fase 8  → DI + Rutas Express
Fase 10 → Testing
```

---

## Resumen de archivos a crear/modificar

### Archivos nuevos
| Archivo | Descripción |
|---------|-------------|
| `src/core/infrastructure/payment-gateways/stripe-subscription.service.ts` | Servicio de Stripe para suscripciones |
| `src/core/domain/entities/subscription.entity.ts` | Entidad Subscription |
| `src/core/domain/interfaces/subscription-repository.interface.ts` | Interfaz del repository |
| `src/core/infrastructure/database/repositories/subscription.repository.ts` | Implementación Prisma |
| `src/core/application/use-cases/subscription/create-subscription-checkout.use-case.ts` | Crear checkout |
| `src/core/application/use-cases/subscription/handle-subscription-webhook.use-case.ts` | Procesar webhooks |
| `src/core/application/use-cases/subscription/get-subscription-status.use-case.ts` | Consultar estado |
| `src/core/application/use-cases/subscription/cancel-subscription.use-case.ts` | Cancelar |
| `src/core/application/use-cases/subscription/reactivate-subscription.use-case.ts` | Reactivar |
| `src/core/application/dto/subscription.dto.ts` | Schemas de validación |
| `src/handlers/subscription/stripe-subscription-webhook.handler.ts` | Webhook handler |
| `src/handlers/subscription/create-subscription-checkout.handler.ts` | Handler crear checkout |
| `src/handlers/subscription/get-subscription-status.handler.ts` | Handler consultar estado |
| `src/handlers/subscription/cancel-subscription.handler.ts` | Handler cancelar |
| `src/handlers/subscription/reactivate-subscription.handler.ts` | Handler reactivar |
| `src/server/routes/subscription.routes.ts` | Rutas Express |
| `src/server/middleware/subscription.middleware.ts` | Middleware de vigencia |

### Archivos a modificar
| Archivo | Cambio |
|---------|--------|
| `schema.prisma` | Agregar enum `SubscriptionStatus` + modelo `Subscription` |
| `src/shared/errors/error-config.ts` | Agregar error codes de suscripción |
| `src/core/infrastructure/config/dependency-injection.ts` | Registrar service, repo, use cases |
| `src/server/routes/index.ts` | Agregar ruta de suscripción + middleware de vigencia |
| `.env` | Agregar `STRIPE_PRICE_ID`, `STRIPE_SUBSCRIPTION_WEBHOOK_SECRET`, URLs |

---

## Consideraciones

### Seguridad
- Siempre validar firma del webhook con `stripe.webhooks.constructEvent()`
- No exponer `stripeCustomerId` ni `stripeSubscriptionId` en respuestas al frontend
- Solo roles ADMIN pueden cancelar/reactivar suscripción

### Período de gracia
- Si el pago falla (`PAST_DUE`), dar 3 días de gracia antes de bloquear
- Stripe reintenta automáticamente el cobro (configurable en Stripe Dashboard → Settings → Subscriptions)
- Después del período de gracia, el middleware bloquea el acceso

### Edge cases
- Si el usuario cierra la pestaña en Stripe Checkout sin pagar → no pasa nada, el registro queda como `EXPIRED`
- Si el usuario intenta crear otro checkout teniendo uno pendiente → Stripe maneja esto, crea nueva sesión
- Si la BD se restaura de un backup → el middleware verificará contra la fecha actual, no contra datos de Stripe

### Diferencias con el flujo de pagos de órdenes

| Aspecto | Pagos de órdenes | Suscripción |
|---------|------------------|-------------|
| Frecuencia | Una vez por orden | Recurrente mensual |
| Gateway | Stripe / MP / Cash | Solo Stripe |
| UI de pago | QR / POS / Stripe Elements | Stripe Checkout (redirect) |
| Confirmación | Webhook + WebSocket | Solo Webhook |
| Moneda | MXN | MXN |
| StripeService | `stripe.service.ts` (PaymentIntents) | `stripe-subscription.service.ts` (Checkout + Subscriptions) |
