# Plan de Implementacion - Pago con QR via Mercado Pago (Backend)

## Objetivo

Permitir que el mesero genere un QR de cobro para una orden, el comensal lo escanee con su celular y pague a traves del checkout de Mercado Pago (tarjeta o SPEI). Esto elimina la friccion del cobro con tarjeta y ofrece una experiencia moderna al comensal.

> **Alcance:** Solo backend. El frontend (mostrar QR en dispositivo del mesero) se implementara en una fase posterior.

---

## Contexto tecnico actual

- **Stripe** se usa para pagos online internos (subscripcion del sistema, `CARD_STRIPE`)
- **Mercado Pago** sera el gateway para pagos del comensal via QR
- SDK de MP **no esta instalado** — se necesita `mercadopago` npm package
- Arquitectura: Use Cases + Repositories + Handlers (Middy) + DI (tsyringe)
- Base de datos: MySQL con Prisma ORM
- Flujo de pago actual: Cash, Transfer, Card Physical (inmediatos) y Card Stripe (2 fases)

---

## Decisiones de diseno

| Tema | Decision | Razon |
|------|----------|-------|
| Gateway | Mercado Pago | Para pagos del comensal; Stripe queda para subscripciones del sistema |
| Producto MP | **Checkout Pro** (Preference API) | Genera URL de pago → se convierte en QR. Soporta tarjeta + SPEI |
| Propina | Se define al crear la orden | No se modifica en el QR |
| Split payment | No soportado con QR | Siempre es el total de la orden |
| Moneda | MXN | Mercado Pago Mexico |
| Confirmacion | Webhook de MP | Asincrono, como el flujo actual de Stripe |

---

## Flujo general

```
1. Mesero selecciona "Cobrar con QR" en la orden
2. Backend crea una Preference en Mercado Pago (monto total de la orden)
3. Backend retorna `init_point` (URL de checkout) + genera QR con esa URL
4. Frontend muestra QR en pantalla del mesero
5. Comensal escanea QR → abre checkout de Mercado Pago en su celular
6. Comensal paga (tarjeta, SPEI, etc.)
7. Mercado Pago envia webhook al backend
8. Backend confirma pago, actualiza orden, libera mesa
9. Mesero ve en tiempo real que el pago fue exitoso (WebSocket)
```

---

## Fase 1: Modelo de datos

> **Dependencias:** Ninguna. Prerequisito para todo lo demas.

### 1.1 Agregar enum `MERCADO_PAGO` al PaymentGateway

```prisma
enum PaymentGateway {
  STRIPE
  PAYPAL
  CASH
  MERCADO_PAGO    // Nuevo
}
```

### 1.2 Agregar enum `QR_MERCADO_PAGO` al PaymentMethod

```prisma
enum PaymentMethod {
  CASH
  TRANSFER
  CARD_PHYSICAL
  CARD_STRIPE
  QR_MERCADO_PAGO   // Nuevo
}
```

### 1.3 Agregar `paymentMethod: 4` para QR

Actualizar la convencion numerica en el campo `Order.paymentMethod`:
- 1: Cash
- 2: Transfer
- 3: Card (Physical o Stripe)
- **4: QR Mercado Pago**

### 1.4 Migracion

```bash
npx prisma migrate dev --name add-mercado-pago-payment-method
```

> **Nota:** No se necesita modelo nuevo. Se reutilizan `Payment` y `PaymentSession` existentes. El campo `gatewayTransactionId` almacenara el `preference_id` o `payment_id` de MP, y `PaymentSession.clientSecret` almacenara el `init_point` (URL de checkout).

---

## Fase 2: Instalar SDK de Mercado Pago

> **Dependencias:** Ninguna

### 2.1 Instalar paquete

```bash
npm install mercadopago
```

### 2.2 Variables de entorno

```env
# Mercado Pago
MP_ACCESS_TOKEN=APP_USR-xxx              # Token de produccion
MP_ACCESS_TOKEN_TEST=TEST-xxx            # Token de pruebas (sandbox)
MP_WEBHOOK_SECRET=xxx                     # Para validar firma de webhooks
MP_NOTIFICATION_URL=https://api.restify.com/webhooks/mercado-pago  # URL publica
```

---

## Fase 3: MercadoPagoService

> **Dependencias:** Fase 2

### 3.1 Crear servicio

Archivo: `src/core/infrastructure/payment-gateways/mercado-pago.service.ts`

Seguir el mismo patron que `StripeService`: clase `@injectable()`, constructor valida env vars, metodos async.

```typescript
@injectable()
export class MercadoPagoService {
  private client: MercadoPagoConfig;
  private preference: Preference;
  private paymentClient: PaymentMP;

  constructor() {
    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) {
      throw new Error('MP_ACCESS_TOKEN environment variable is required');
    }
    this.client = new MercadoPagoConfig({ accessToken });
    this.preference = new Preference(this.client);
    this.paymentClient = new PaymentMP(this.client);
  }
}
```

### 3.2 Metodos del servicio

```typescript
// --- Preferences (Checkout Pro) ---

/**
 * Crea una preferencia de pago.
 * Retorna init_point (URL) que se usa para generar el QR.
 */
async createPreference(params: CreateMPPreferenceParams): Promise<MPPreferenceResult>;

/**
 * Obtiene el estado de una preferencia.
 */
async getPreference(preferenceId: string): Promise<MPPreferenceResult>;

// --- Payments ---

/**
 * Consulta un pago por su ID (para confirmar en webhook).
 */
async getPayment(paymentId: string): Promise<MPPaymentResult>;

// --- Webhooks ---

/**
 * Valida la firma del webhook de Mercado Pago.
 */
validateWebhookSignature(params: ValidateWebhookParams): boolean;
```

### 3.3 Interfaces

```typescript
export interface CreateMPPreferenceParams {
  orderId: string;
  title: string;           // "Orden #xxx - Restify"
  description?: string;    // Resumen de items
  amount: number;          // Total en MXN (no centavos, MP usa decimales)
  currency: string;        // "MXN"
  metadata: {
    orderId: string;
    paymentId: string;
    companyId?: string;
  };
  notificationUrl: string;  // URL webhook
  expirationDate?: string;  // ISO date - auto-expirar preference
}

export interface MPPreferenceResult {
  id: string;              // Preference ID
  initPoint: string;       // URL de checkout (para generar QR)
  sandboxInitPoint: string; // URL de sandbox
  expirationDate: string | null;
}

export interface MPPaymentResult {
  id: number;              // MP Payment ID
  status: string;          // "approved", "pending", "rejected", etc.
  statusDetail: string;    // "accredited", "pending_waiting_transfer", etc.
  externalReference: string; // Nuestro orderId
  transactionAmount: number;
  currencyId: string;
  paymentMethodId: string;  // "visa", "master", "pix", "bank_transfer", etc.
  paymentTypeId: string;    // "credit_card", "debit_card", "bank_transfer"
  dateApproved: string | null;
}

export interface ValidateWebhookParams {
  xSignature: string;      // Header x-signature
  xRequestId: string;      // Header x-request-id
  dataId: string;          // query param data.id
}
```

### 3.4 Implementacion de `createPreference`

```typescript
async createPreference(params: CreateMPPreferenceParams): Promise<MPPreferenceResult> {
  const preference = await this.preference.create({
    body: {
      items: [
        {
          id: params.orderId,
          title: params.title,
          description: params.description || '',
          quantity: 1,
          unit_price: params.amount,
          currency_id: params.currency,
        },
      ],
      metadata: params.metadata,
      external_reference: params.orderId,
      notification_url: params.notificationUrl,
      auto_return: 'approved',
      expires: true,
      expiration_date_to: params.expirationDate,   // 30 min desde ahora
      payment_methods: {
        excluded_payment_types: [
          { id: 'ticket' },    // Excluir OXXO y similares
        ],
        installments: 1,       // Sin meses sin intereses
      },
    },
  });

  return {
    id: preference.id!,
    initPoint: preference.init_point!,
    sandboxInitPoint: preference.sandbox_init_point!,
    expirationDate: preference.expiration_date_to || null,
  };
}
```

---

## Fase 4: Use Cases

> **Dependencias:** Fases 1, 3

### 4.1 `PayOrderWithQRMercadoPago` (Generar QR)

Archivo: `src/core/application/use-cases/payments/pay-order-with-qr-mercado-pago.use-case.ts`

**Input:**
```typescript
interface PayOrderWithQRMercadoPagoInput {
  orderId: string;
  userId: string;       // Mesero que genera el QR
  connectionId?: string; // WebSocket para notificar cuando se pague
}
```

**Flujo:**
1. Validar que la orden existe y NO esta pagada
2. Validar que no existe un pago pendiente de MP para esta orden
3. Crear registro `Payment` con:
   - `status: PENDING`
   - `paymentMethod: QR_MERCADO_PAGO`
   - `gateway: MERCADO_PAGO`
   - `amount: order.total`
   - `currency: MXN`
4. Crear Preference en Mercado Pago via `MercadoPagoService.createPreference()`:
   - `title: "Orden #{orderId corto} - {companyName}"`
   - `amount: order.total`
   - `metadata: { orderId, paymentId }`
   - `notificationUrl: MP_NOTIFICATION_URL`
   - `expirationDate: now + 30 min`
5. Actualizar Payment con `gatewayTransactionId = preference.id`
6. Crear `PaymentSession` con:
   - `clientSecret: preference.initPoint` (URL de checkout)
   - `connectionId: input.connectionId`
   - `expiresAt: now + 30 min`
7. Retornar `{ paymentId, preferenceId, initPoint, expiresAt }`

**Output:**
```typescript
interface PayOrderWithQRMercadoPagoResult {
  paymentId: string;
  preferenceId: string;
  initPoint: string;      // URL para generar QR en el frontend
  expiresAt: Date;
}
```

> **El frontend toma el `initPoint` y genera un QR code con una libreria como `qrcode`.**

### 4.2 `ConfirmMercadoPagoPayment` (Webhook)

Archivo: `src/core/application/use-cases/payments/confirm-mercado-pago-payment.use-case.ts`

**Input:**
```typescript
interface ConfirmMPPaymentInput {
  mpPaymentId: number;    // ID del pago en MP
  action: string;         // "payment.created" o "payment.updated"
}
```

**Flujo:**
1. Obtener detalles del pago desde MP: `mercadoPagoService.getPayment(mpPaymentId)`
2. Extraer `external_reference` (nuestro `orderId`) del pago de MP
3. Buscar `Payment` en BD por `orderId` + `gateway: MERCADO_PAGO` + `status: PENDING`
4. Si no existe pago pendiente → ignorar (idempotencia)
5. Mapear status de MP a nuestro `PaymentStatus`:
   - `approved` → `SUCCEEDED`
   - `pending` → `PROCESSING`
   - `rejected` → `FAILED`
   - `cancelled` → `CANCELED`
   - `in_process` → `PROCESSING`
6. Si `SUCCEEDED`:
   - Actualizar Payment: `status = SUCCEEDED`, `gatewayTransactionId = mpPaymentId`
   - Actualizar Order: `status = true`, `paymentMethod = 4`
   - Liberar mesa si es orden local
   - Notificar via WebSocket (usar `connectionId` de PaymentSession)
   - Encolar notificacion de pago via SQS
7. Si `FAILED` o `CANCELED`:
   - Actualizar Payment status
   - Notificar via WebSocket
8. Si `PROCESSING`:
   - Actualizar Payment status (no cerrar la orden aun)

### 4.3 `GetQRPaymentStatus` (Polling opcional)

Archivo: `src/core/application/use-cases/payments/get-qr-payment-status.use-case.ts`

**Flujo:**
1. Buscar Payment por `orderId` + `gateway: MERCADO_PAGO`
2. Si el status es `PENDING` o `PROCESSING`, consultar MP directamente para tener el estado mas reciente
3. Retornar status actual

> **Nota:** Este use case es un fallback. El flujo principal es via webhook + WebSocket.

---

## Fase 5: Webhook Handler

> **Dependencias:** Fases 3, 4

### 5.1 Handler de webhooks de Mercado Pago

Archivo: `src/handlers/payments/mercado-pago-webhook.handler.ts`

```typescript
const mercadoPagoWebhookHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  const mercadoPagoService = container.resolve(MercadoPagoService);

  // 1. Validar firma del webhook
  const xSignature = event.headers['x-signature'] || '';
  const xRequestId = event.headers['x-request-id'] || '';
  const queryParams = event.queryStringParameters || {};

  const isValid = mercadoPagoService.validateWebhookSignature({
    xSignature,
    xRequestId,
    dataId: queryParams['data.id'] || '',
  });

  if (!isValid) {
    throw new AppError('INVALID_WEBHOOK_SIGNATURE');
  }

  // 2. Parsear body
  const body = JSON.parse(event.body || '{}');

  // 3. Solo procesar eventos de pago
  if (body.type === 'payment') {
    const confirmUseCase = container.resolve(ConfirmMercadoPagoPaymentUseCase);
    await confirmUseCase.execute({
      mpPaymentId: body.data.id,
      action: body.action,
    });
  }

  return { received: true };
};
```

> **Importante:** No usar `httpJsonBodyParser` — se necesita el body raw para validar firma. Mismo patron que webhooks de Stripe.

### 5.2 Middleware del handler

```typescript
export const mercadoPagoWebhookHandler = middy(mercadoPagoWebhookHandlerBase)
  .use(httpEventNormalizer())
  // NO httpJsonBodyParser — body raw para firma
  .use(customErrorHandler())
  .use(responseFormatter());
```

### 5.3 Idempotencia

- Verificar que el Payment no este ya en `SUCCEEDED` antes de procesarlo
- Si el webhook llega duplicado y el pago ya esta confirmado → retornar 200 sin hacer nada
- Usar `mpPaymentId` como referencia para evitar procesamiento doble

---

## Fase 6: Handlers (API Endpoints)

> **Dependencias:** Fase 4

### 6.1 Endpoints nuevos

| Metodo | Ruta                                  | Handler                          | Descripcion                         |
|--------|---------------------------------------|----------------------------------|-------------------------------------|
| POST   | `/payments/qr-mercado-pago`           | payOrderWithQRMercadoPagoHandler | Generar QR de cobro                 |
| GET    | `/payments/qr-mercado-pago/:orderId`  | getQRPaymentStatusHandler        | Consultar estado del pago QR        |
| POST   | `/webhooks/mercado-pago`              | mercadoPagoWebhookHandler        | Recibir webhooks de MP              |

### 6.2 Handler: Generar QR

Archivo: `src/handlers/payments/pay-order-with-qr-mercado-pago.handler.ts`

```typescript
const payOrderWithQRMercadoPagoHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  const validatedData = event.body as any;
  const useCase = container.resolve(PayOrderWithQRMercadoPagoUseCase);
  const result = await useCase.execute(validatedData);
  return result;
};

export const payOrderWithQRMercadoPagoHandler = middy(payOrderWithQRMercadoPagoHandlerBase)
  .use(httpEventNormalizer())
  .use(httpJsonBodyParser())
  .use(zodValidator({ schema: payOrderWithQRMercadoPagoSchema, eventKey: 'body' }))
  .use(customErrorHandler())
  .use(responseFormatter());
```

### 6.3 DTOs (Zod Schemas)

Archivo: Agregar a `src/core/application/dto/payment.dto.ts`

```typescript
export const payOrderWithQRMercadoPagoSchema = z.object({
  orderId: z.string().uuid(),
  userId: z.string().uuid(),
  connectionId: z.string().optional(),  // WebSocket connection ID
});

export const getQRPaymentStatusSchema = z.object({
  orderId: z.string().uuid(),
});
```

---

## Fase 7: Registro en DI Container

> **Dependencias:** Fases 3, 4

### 7.1 Actualizar `dependency-injection.ts`

```typescript
// Services
container.registerSingleton(MercadoPagoService);

// Use Cases
container.register(PayOrderWithQRMercadoPagoUseCase, PayOrderWithQRMercadoPagoUseCase);
container.register(ConfirmMercadoPagoPaymentUseCase, ConfirmMercadoPagoPaymentUseCase);
container.register(GetQRPaymentStatusUseCase, GetQRPaymentStatusUseCase);
```

---

## Fase 8: Rutas (Serverless + Express)

> **Dependencias:** Fase 6

### 8.1 serverless.yml

```yaml
# Mercado Pago QR Payment
payOrderWithQRMercadoPago:
  handler: src/handlers/payments/pay-order-with-qr-mercado-pago.handler.payOrderWithQRMercadoPagoHandler
  events:
    - http:
        path: payments/qr-mercado-pago
        method: post
        authorizer: ${self:custom.authorizer}

getQRPaymentStatus:
  handler: src/handlers/payments/get-qr-payment-status.handler.getQRPaymentStatusHandler
  events:
    - http:
        path: payments/qr-mercado-pago/{orderId}
        method: get
        authorizer: ${self:custom.authorizer}

mercadoPagoWebhook:
  handler: src/handlers/payments/mercado-pago-webhook.handler.mercadoPagoWebhookHandler
  events:
    - http:
        path: webhooks/mercado-pago
        method: post
        # Sin authorizer - Mercado Pago envia directamente
```

### 8.2 Express routes (desarrollo local)

Agregar a `src/server/routes/payment.routes.ts`:

```typescript
router.post('/payments/qr-mercado-pago', adaptHandler(payOrderWithQRMercadoPagoHandler));
router.get('/payments/qr-mercado-pago/:orderId', adaptHandler(getQRPaymentStatusHandler));
router.post('/webhooks/mercado-pago', adaptHandler(mercadoPagoWebhookHandler));
```

---

## Fase 9: Integracion con reportes

> **Dependencias:** Fase 4

### 9.1 Actualizar reportes de flujo de caja

Los pagos con `paymentMethod: 4` (QR MP) deben aparecer en los reportes de ventas y flujo de caja. Revisar:

- `FlowCashReport` / estrategias de reporte existentes
- Agregar `QR_MERCADO_PAGO` como metodo de pago reconocido
- Mapear `paymentMethod: 4` al label "QR Mercado Pago" en los reportes

### 9.2 Actualizar ticket de venta

El ticket de venta (`sale-ticket`) debe mostrar "Pago con QR - Mercado Pago" cuando `paymentMethod = 4`.

---

## Fase 10: Testing

> **Dependencias:** Todas las fases anteriores

### 10.1 Tests unitarios

- `MercadoPagoService`: mockear SDK de MP
- `PayOrderWithQRMercadoPagoUseCase`: mockear service + repositories
- `ConfirmMercadoPagoPaymentUseCase`: probar todos los status de MP (approved, rejected, pending, cancelled)
- Mapeo de status MP → PaymentStatus

### 10.2 Tests de integracion

- Webhook handler con payloads simulados de MP
- Flujo completo: generar QR → webhook → orden pagada
- Idempotencia: enviar mismo webhook 2 veces → solo un pago procesado

### 10.3 Testing con Mercado Pago Sandbox

```
1. Usar MP_ACCESS_TOKEN_TEST en ambiente de desarrollo
2. Crear preference con sandbox token
3. Usar sandboxInitPoint en lugar de initPoint
4. Pagar con tarjetas de prueba de MP:
   - Visa: 4509 9535 6623 3704 (approved)
   - Mastercard: 5031 7557 3453 0604 (approved)
   - CVV: 123, Vencimiento: 11/25
   - Nombre: APRO (approved), OTHE (rejected)
5. MP enviara webhook a notification_url
```

> **Tip:** Usar ngrok para exponer localhost y recibir webhooks de MP en desarrollo.

---

## Orden de implementacion recomendado

```
Fase 2  → Instalar SDK + variables de entorno
Fase 1  → Modelo de datos (enums en Prisma + migracion)
Fase 3  → MercadoPagoService
Fase 4  → Use Cases
Fase 7  → Registro en DI
Fase 5  → Webhook handler
Fase 6  → Handlers + DTOs
Fase 8  → Rutas (serverless + Express)
Fase 9  → Integracion con reportes
Fase 10 → Testing
```

---

## Resumen de archivos a crear/modificar

### Archivos nuevos
| Archivo | Descripcion |
|---------|-------------|
| `src/core/infrastructure/payment-gateways/mercado-pago.service.ts` | Servicio de Mercado Pago |
| `src/core/application/use-cases/payments/pay-order-with-qr-mercado-pago.use-case.ts` | Generar QR de cobro |
| `src/core/application/use-cases/payments/confirm-mercado-pago-payment.use-case.ts` | Confirmar pago via webhook |
| `src/core/application/use-cases/payments/get-qr-payment-status.use-case.ts` | Consultar estado del pago QR |
| `src/handlers/payments/pay-order-with-qr-mercado-pago.handler.ts` | Handler para generar QR |
| `src/handlers/payments/get-qr-payment-status.handler.ts` | Handler para consultar estado |
| `src/handlers/payments/mercado-pago-webhook.handler.ts` | Handler para webhooks de MP |

### Archivos a modificar
| Archivo | Cambio |
|---------|--------|
| `schema.prisma` | Agregar `QR_MERCADO_PAGO` a PaymentMethod, `MERCADO_PAGO` a PaymentGateway |
| `src/core/application/dto/payment.dto.ts` | Agregar schemas de validacion |
| `src/core/infrastructure/config/dependency-injection.ts` | Registrar service + use cases |
| `src/server/routes/payment.routes.ts` | Agregar rutas Express |
| `serverless.yml` | Agregar funciones Lambda |
| Reportes de flujo de caja | Reconocer `paymentMethod: 4` |
| Ticket de venta | Mostrar label "QR Mercado Pago" |

---

## Consideraciones

### Seguridad
- Siempre validar firma del webhook de MP (`x-signature` + HMAC)
- No exponer access token de MP en respuestas
- Preference expira en 30 min — no reutilizar QRs viejos
- Solo roles ADMIN, MANAGER, WAITER pueden generar QR de cobro

### UX del mesero
- Si el pago QR expira (30 min), el mesero puede generar uno nuevo
- Si el comensal no paga, la orden queda abierta — el mesero puede cobrar con otro metodo
- WebSocket notifica al mesero en tiempo real cuando el pago se confirma

### Concurrencia
- Si el mesero genera un QR y el comensal no paga, y luego el mesero cobra en efectivo:
  - El pago en efectivo cierra la orden (`status = true`)
  - Si despues llega el webhook de MP, se ignora porque la orden ya esta pagada
  - El pago PENDING de MP queda como `CANCELED` (cleanup periodico o al detectar orden pagada)

### Diferencias con el flujo de Stripe
| Aspecto | Stripe (actual) | Mercado Pago QR (nuevo) |
|---------|-----------------|-------------------------|
| Iniciador | Comensal (ingresa tarjeta) | Mesero (genera QR) |
| Checkout | client_secret + Stripe.js | init_point URL → QR |
| Confirmacion | Frontend llama `/confirm` | Webhook automatico de MP |
| Moneda | USD | MXN |
| Metodos de pago | Solo tarjeta | Tarjeta + SPEI |
