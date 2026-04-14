# Plan de Implementación — Verificación de Checkout de Suscripción

> **Fecha:** 2026-04-14
> **Proyecto:** Restify (Backend + Frontend)
> **Objetivo:** Garantizar que el estado de la suscripción se actualice en BD incluso si el webhook de Stripe falla, usando el redirect post-pago como fallback de verificación.

---

## Problema

Cuando un usuario paga una suscripción via Stripe Checkout, el flujo actual depende exclusivamente del webhook para actualizar la BD:

```
1. Usuario paga en Stripe Checkout → Stripe cobra
2. Stripe redirige al frontend → /subscription/success
3. Stripe envía webhook → backend actualiza BD (status: ACTIVE)
```

Si el paso 3 falla (URL mal configurada, signing secret incorrecto, backend caído, timeout), el pago queda cobrado en Stripe pero la suscripción en BD sigue como `EXPIRED`. El usuario pagó pero no puede usar el sistema.

Actualmente `SubscriptionSuccessPage` hace `fetchStatus()` que lee de BD — si el webhook no actualizó, sigue viendo EXPIRED.

---

## Solución

Agregar un endpoint `POST /api/subscription/verify-checkout` que actúe como fallback: consulta a Stripe directamente el estado del checkout session y, si está pagado, actualiza la BD.

El frontend llama a este endpoint desde `SubscriptionSuccessPage` con el `session_id` que Stripe pasa como query param en la URL de success.

### Flujo corregido

```
1. Usuario paga en Stripe Checkout → Stripe cobra
2. Stripe redirige a /subscription/success?session_id=cs_xxx
3. Frontend llama POST /api/subscription/verify-checkout { sessionId: "cs_xxx" }
4. Backend consulta a Stripe API → obtiene estado del checkout session
5. Si pagado y BD no actualizada → actualiza suscripción en BD
6. Retorna estado actual al frontend
7. (En paralelo) Stripe envía webhook → backend actualiza BD (idempotente)
```

Si el webhook llega primero, el verify-checkout detecta que ya está actualizado y no hace nada (idempotente). Si el webhook falla, el verify-checkout actúa como fallback.

---

## Contexto Técnico

### Archivos relevantes (backend)

| Archivo | Rol |
|---------|-----|
| `src/core/infrastructure/payment-gateways/stripe-subscription.service.ts` | Servicio Stripe: ya tiene `getSubscription()`, falta `getCheckoutSession()` |
| `src/core/application/use-cases/subscription/handle-subscription-webhook.use-case.ts` | Webhook handler: lógica de `handleCheckoutCompleted` que se reutiliza |
| `src/core/application/use-cases/subscription/create-subscription-checkout.use-case.ts` | Crea checkout session, retorna `sessionId` |
| `src/core/domain/interfaces/subscription-repository.interface.ts` | Interface del repositorio: `find()`, `update()` |
| `src/server/routes/subscription.routes.ts` | Rutas de suscripción (auth requerido) |
| `src/core/infrastructure/config/dependency-injection/subscription.module.ts` | DI container |

### Archivos relevantes (frontend)

| Archivo | Rol |
|---------|-----|
| `src/presentation/pages/subscription/SubscriptionSuccessPage.tsx` | Página post-pago: actualmente solo hace `fetchStatus()` |
| `src/presentation/store/subscription.store.ts` | Store de suscripción |

### Stripe API relevante

- `stripe.checkout.sessions.retrieve(sessionId)` → retorna el checkout session con `payment_status`, `subscription` (ID), `customer`
- `stripe.subscriptions.retrieve(subscriptionId)` → retorna detalles de la suscripción

### URL de success actual

```typescript
const successUrl = process.env.STRIPE_SUCCESS_URL || 'http://localhost:5173/subscription/success';
```

Stripe **no agrega `session_id` automáticamente** al redirect URL. Hay que configurarlo explícitamente:

```typescript
successUrl: `${baseUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
```

`{CHECKOUT_SESSION_ID}` es un template que Stripe reemplaza con el ID real.

---

## Fase 1 — Backend: Método en StripeSubscriptionService

### 1.1 Agregar `getCheckoutSession` al servicio de Stripe

Agregar método a `StripeSubscriptionService` que recupere un checkout session por ID:

```typescript
async getCheckoutSession(sessionId: string): Promise<{
  id: string;
  paymentStatus: string; // 'paid' | 'unpaid' | 'no_payment_required'
  subscriptionId: string | null;
  customerId: string | null;
}> {
  const session = await this.stripe.checkout.sessions.retrieve(sessionId);
  return {
    id: session.id,
    paymentStatus: session.payment_status,
    subscriptionId: session.subscription as string | null,
    customerId: session.customer as string | null,
  };
}
```

**Archivo:** `src/core/infrastructure/payment-gateways/stripe-subscription.service.ts`

### Checklist Fase 1

- [ ] Agregar método `getCheckoutSession` a `StripeSubscriptionService`.

---

## Fase 2 — Backend: Use Case de Verificación

### 2.1 Crear `VerifySubscriptionCheckoutUseCase`

**Archivo nuevo:** `src/core/application/use-cases/subscription/verify-subscription-checkout.use-case.ts`

**Lógica:**

```typescript
@injectable()
export class VerifySubscriptionCheckoutUseCase {
  constructor(
    @inject('ISubscriptionRepository') subscriptionRepository,
    @inject(StripeSubscriptionService) stripeSubscriptionService,
  ) {}

  async execute(input: { sessionId: string }): Promise<{ status: string; verified: boolean }> {
    // 1. Obtener checkout session de Stripe
    const session = await this.stripeSubscriptionService.getCheckoutSession(input.sessionId);

    // 2. Si no está pagado, retornar sin cambios
    if (session.paymentStatus !== 'paid' || !session.subscriptionId) {
      return { status: 'PENDING', verified: false };
    }

    // 3. Buscar suscripción local
    const subscription = await this.subscriptionRepository.find();
    if (!subscription) {
      return { status: 'NOT_FOUND', verified: false };
    }

    // 4. Si ya está ACTIVE, no hacer nada (idempotente)
    if (subscription.status === 'ACTIVE') {
      return { status: 'ACTIVE', verified: true };
    }

    // 5. Obtener detalles de la suscripción de Stripe
    const stripeSub = await this.stripeSubscriptionService.getSubscription(session.subscriptionId);
    const metadata = await this.stripeSubscriptionService.getSubscriptionMetadata(session.subscriptionId);

    // 6. Actualizar BD
    await this.subscriptionRepository.update(subscription.id, {
      stripeSubscriptionId: session.subscriptionId,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: stripeSub.currentPeriodStart,
      currentPeriodEnd: stripeSub.currentPeriodEnd,
      planId: metadata.planId || subscription.planId,
    });

    return { status: 'ACTIVE', verified: true };
  }
}
```

**Puntos clave:**
- Idempotente: si la suscripción ya es ACTIVE, no hace nada.
- Reutiliza `getSubscription()` y `getSubscriptionMetadata()` que ya existen.
- No depende del webhook — consulta Stripe directamente.

### Checklist Fase 2

- [ ] Crear `VerifySubscriptionCheckoutUseCase`.
- [ ] Registrar en DI container (`subscription.module.ts`).

---

## Fase 3 — Backend: Controller y Ruta

### 3.1 Crear controller

**Archivo nuevo:** `src/controllers/subscription/verify-subscription-checkout.controller.ts`

Usa `makeBodyController` existente: recibe `{ sessionId }` del body.

### 3.2 Agregar ruta

**Archivo:** `src/server/routes/subscription.routes.ts`

```typescript
/** POST /api/subscription/verify-checkout — Verifica y actualiza estado post-pago */
router.post('/verify-checkout', verifySubscriptionCheckoutController);
```

La ruta va **después** del middleware `AuthMiddleware.authenticate` y `AuthMiddleware.authorize('ADMIN')` ya que solo el admin gestiona suscripciones.

### 3.3 Agregar schema Zod de validación

**Archivo:** Crear schema en DTO o inline:

```typescript
const verifyCheckoutSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
});
```

### Checklist Fase 3

- [ ] Crear controller `verifySubscriptionCheckoutController`.
- [ ] Agregar ruta `POST /verify-checkout` en `subscription.routes.ts` (autenticada, ADMIN).
- [ ] Agregar validación Zod en la ruta.

---

## Fase 4 — Backend: Agregar session_id a la URL de success

### 4.1 Modificar `CreateSubscriptionCheckoutUseCase`

Agregar `?session_id={CHECKOUT_SESSION_ID}` a la `successUrl` para que Stripe inyecte el ID real en el redirect:

**Archivo:** `src/core/application/use-cases/subscription/create-subscription-checkout.use-case.ts`

**Cambio:**

```typescript
// Antes:
const successUrl = process.env.STRIPE_SUCCESS_URL || 'http://localhost:5173/subscription/success';

// Después:
const baseSuccessUrl = process.env.STRIPE_SUCCESS_URL || 'http://localhost:5173/subscription/success';
const successUrl = `${baseSuccessUrl}?session_id={CHECKOUT_SESSION_ID}`;
```

`{CHECKOUT_SESSION_ID}` es un placeholder que Stripe reemplaza automáticamente con el ID del checkout session al redirigir.

### Checklist Fase 4

- [ ] Modificar `successUrl` para incluir `?session_id={CHECKOUT_SESSION_ID}`.

---

## Fase 5 — Frontend: Llamar verify-checkout desde SubscriptionSuccessPage

### 5.1 Agregar método al servicio/repositorio de suscripción

Agregar `verifyCheckout(sessionId: string)` que llame `POST /api/subscription/verify-checkout`.

### 5.2 Modificar `SubscriptionSuccessPage`

**Archivo:** `src/presentation/pages/subscription/SubscriptionSuccessPage.tsx`

**Cambios:**
1. Leer `session_id` de los query params de la URL (`useSearchParams`).
2. Al montar, llamar `verifyCheckout(sessionId)` en vez de solo `fetchStatus()`.
3. Mostrar estado de verificación (loading, éxito, error).
4. Si la verificación falla, mostrar botón "Reintentar" y mensaje de contacto.

**Flujo:**

```typescript
const [searchParams] = useSearchParams();
const sessionId = searchParams.get('session_id');

useEffect(() => {
  if (sessionId) {
    // Verificar con Stripe y actualizar BD si necesario
    subscriptionService.verifyCheckout(sessionId)
      .then(() => fetchStatus())
      .catch(() => setError(true));
  } else {
    // Fallback: solo leer status de BD (ej. usuario llegó sin session_id)
    fetchStatus();
  }
}, [sessionId]);
```

### Checklist Fase 5

- [ ] Agregar `verifyCheckout` al servicio/repositorio de suscripción del frontend.
- [ ] Modificar `SubscriptionSuccessPage` para leer `session_id` y llamar verify.
- [ ] Manejar estados: loading, éxito, error con retry.

---

## Fase 6 — Tests

### 6.1 Test unitario del use case

**Archivo nuevo:** `tests/unit/use-cases/subscription/verify-subscription-checkout.use-case.test.ts`

**Casos:**
1. Checkout session pagada, suscripción EXPIRED → actualiza a ACTIVE, retorna `{ verified: true }`.
2. Checkout session pagada, suscripción ya ACTIVE → no actualiza, retorna `{ verified: true }` (idempotencia).
3. Checkout session no pagada → retorna `{ verified: false }`.
4. Suscripción no existe en BD → retorna `{ verified: false }`.
5. Session sin subscriptionId → retorna `{ verified: false }`.

### Checklist Fase 6

- [ ] Crear test unitario con los 5 casos.
- [ ] Verificar que tests existentes sigan pasando.

---

## Orden de Implementación

```
Fase 1 (Método Stripe) → getCheckoutSession
  │
  └── Fase 2 (Use Case) → VerifySubscriptionCheckoutUseCase
        │
        ├── Fase 3 (Controller + Ruta) → POST /verify-checkout
        │
        └── Fase 4 (session_id en URL) → template en successUrl
              │
              └── Fase 5 (Frontend) → SubscriptionSuccessPage llama verify
                    │
                    └── Fase 6 (Tests) → Cobertura del use case
```

---

## Consideraciones

- **Idempotencia:** El use case no hace nada si la suscripción ya es ACTIVE. El webhook y el verify-checkout pueden ejecutarse en cualquier orden sin conflicto.
- **Seguridad:** La ruta requiere auth + ADMIN. El `sessionId` es un token de Stripe que solo se obtiene al completar el checkout — no es adivinable.
- **Sin cambios en BD/schema:** No se necesitan migraciones. Se reutiliza la entidad y repositorio existentes.
- **Compatibilidad:** Si `session_id` no está en la URL (checkout viejo), el frontend hace fallback a `fetchStatus()` como antes.
- **Variable de entorno:** `STRIPE_SUCCESS_URL` no cambia. El template `{CHECKOUT_SESSION_ID}` se agrega en el código, no en la env var.
