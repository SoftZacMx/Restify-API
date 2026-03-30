# Plan de Migración: Lambda/Middy → Express Puro

## Contexto

El proyecto tiene una arquitectura híbrida donde 77 handlers están escritos como AWS Lambda functions (con Middy), pero se ejecutan dentro de Express mediante un `HttpToLambdaAdapter` que convierte Request/Response entre ambos formatos. Esto genera overhead innecesario (doble serialización) y complejidad sin beneficio, ya que no se despliega en Lambda.

**Objetivo:** Eliminar la capa Lambda/Middy y dejar Express como única tecnología de servidor.

**Lo que NO se toca:** Los use cases, repositorios, entidades y lógica de negocio se mantienen intactos.

---

## Fase 1: Middlewares Express equivalentes

> Dependencia: Ninguna. Es la base para las fases siguientes.

### Tarea 1.1: Reescribir `zod-validator.middleware.ts`

- Convertir de middleware Middy a middleware Express `(req, res, next)`
- Cambiar `eventKey` (body/queryStringParameters/pathParameters) → `source` (body/query/params)
- Validar con Zod y llamar `next()` o `next(AppError)` en error
- **Archivo:** `src/shared/middleware/zod-validator.middleware.ts`

### Tarea 1.2: Reescribir `error-handler.middleware.ts`

- Convertir de `onError` de Middy a error handler Express `(err, req, res, next)`
- Mantener toda la lógica de `convertToAppError`, `mapStringToAppError`, `mapErrorToAppError`
- Reemplazar `ApiResponseHandler.error()` por `res.status().json()`
- **Archivo:** `src/shared/middleware/error-handler.middleware.ts`

### Tarea 1.3: Reescribir `response-formatter.middleware.ts`

- Convertir de middleware Middy `after` a helper function `sendSuccess(res, data, statusCode)`
- Formato: `{ success: true, data, timestamp }`
- **Archivo:** `src/shared/middleware/response-formatter.middleware.ts`

---

## Fase 2: Migrar handlers a controllers Express

> Dependencia: Fase 1 (los controllers usan `sendSuccess` y delegan errores a `next()`)

Todos los handlers siguen el mismo patrón. La conversión es mecánica:

**Antes (Lambda):**
```typescript
const handlerBase = async (event: APIGatewayProxyEvent): Promise<any> => {
  const data = event.body as any;
  const useCase = container.resolve(UseCase);
  return await useCase.execute(data);
};
export const handler = middy(handlerBase)
  .use(httpEventNormalizer())
  .use(httpJsonBodyParser())
  .use(zodValidator({ schema, eventKey: 'body' }))
  .use(customErrorHandler())
  .use(responseFormatter());
```

**Después (Express):**
```typescript
export const controller = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const useCase = container.resolve(UseCase);
    const result = await useCase.execute(req.body);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
```

### Patrones de acceso a datos por tipo de handler

| Patrón | Antes (Lambda) | Después (Express) | Handlers |
|--------|----------------|-------------------|----------|
| Body (POST/PUT) | `event.body` | `req.body` | create*, update*, pay*, login, verify-user |
| Path params (GET/:id, DELETE/:id) | `event.pathParameters?.id` | `req.params.id` | get*, delete*, set-password |
| Query params (GET con filtros) | `event.queryStringParameters` | `req.query` | list*, generate-report, get-summary |
| Sin input (GET simple) | — | — | get-dashboard, logout |
| Body + Params | `event.body` + `event.pathParameters` | `req.body` + `req.params` | pay-order (orderId), set-password |

### Tarea 2.1: Migrar handlers de Auth (4 archivos)

- `login.handler.ts` → `login.controller.ts`
- `logout.handler.ts` → `logout.controller.ts`
- `verify-user.handler.ts` → `verify-user.controller.ts`
- `set-password.handler.ts` → `set-password.controller.ts`
- **Directorio:** `src/handlers/auth/`

### Tarea 2.2: Migrar handlers de Orders (8 archivos)

- create, get, list, update, delete, pay, kitchen-ticket, sale-ticket
- **Directorio:** `src/handlers/orders/`

### Tarea 2.3: Migrar handlers de Payments (10 archivos)

- cash, transfer, card-physical, card-stripe, qr-mercado-pago, split-payment
- confirm-stripe, get, list, get-session, get-qr-status
- **Caso especial:** `mercado-pago-webhook.handler.ts` — recibe body raw, extraer headers manualmente
- **Directorio:** `src/handlers/payments/`

### Tarea 2.4: Migrar handlers de Users (6 archivos)

- create, get, list, update, delete, reactivate
- **Directorio:** `src/handlers/users/`

### Tarea 2.5: Migrar handlers de Products (5 archivos)

- create, get, list, update, delete
- **Directorio:** `src/handlers/products/`

### Tarea 2.6: Migrar handlers de Tables (5 archivos)

- create, get, list, update, delete
- **Directorio:** `src/handlers/tables/`

### Tarea 2.7: Migrar handlers de Menu Categories (5 archivos)

- create, get, list, update, delete
- **Directorio:** `src/handlers/menu-categories/`

### Tarea 2.8: Migrar handlers de Menu Items (5 archivos)

- create, get, list, update, delete
- **Directorio:** `src/handlers/menu-items/`

### Tarea 2.9: Migrar handlers de Expenses (5 archivos)

- create, get, list, update, delete
- **Directorio:** `src/handlers/expenses/`

### Tarea 2.10: Migrar handlers de Refunds (5 archivos)

- create, create-stripe, process-stripe, get, list
- **Directorio:** `src/handlers/refunds/`

### Tarea 2.11: Migrar handlers de Employee Salaries (6 archivos)

- create, get, list, update, delete, index
- **Directorio:** `src/handlers/employee-salaries/`

### Tarea 2.12: Migrar handlers de Subscription (5 archivos)

- create-checkout, get-status, cancel, reactivate
- **Caso especial:** `stripe-webhook.handler.ts` — recibe body raw + `stripe-signature` header
- **Directorio:** `src/handlers/subscription/`

### Tarea 2.13: Migrar handlers de Dashboard (1 archivo)

- get-dashboard
- **Directorio:** `src/handlers/dashboard/`

### Tarea 2.14: Migrar handlers de Company (2 archivos)

- get-company, upsert-company
- **Directorio:** `src/handlers/company/`

### Tarea 2.15: Migrar handlers de Reports (2 archivos)

- get-summary, generate-report
- **Directorio:** `src/handlers/reports/`

### Tarea 2.16: Migrar handlers de WebSocket (2 archivos)

- connect, disconnect
- **Caso especial:** Usan `APIGatewayProxyWebsocketEventV2`, requieren adaptación diferente
- **Directorio:** `src/handlers/websocket/`

---

## Fase 3: Simplificar archivos de rutas

> Dependencia: Fase 2 (las rutas necesitan los controllers ya migrados)

Eliminar el `HttpToLambdaAdapter` de cada ruta y conectar directamente a controllers.

**Antes:**
```typescript
router.post('/', async (req, res) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req);
    const context = HttpToLambdaAdapter.createContext();
    const response = await handler(event as any, context);
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    res.status(500).json({ ... });
  }
});
```

**Después:**
```typescript
router.post('/', validate(schema), controller);
```

### Tarea 3.1: Simplificar `auth.routes.ts`

- Mantener rate limiters y lógica de cookies (login/logout)
- **Archivo:** `src/server/routes/auth.routes.ts`

### Tarea 3.2: Simplificar `order.routes.ts`

- **Archivo:** `src/server/routes/order.routes.ts`

### Tarea 3.3: Simplificar `payment.routes.ts`

- Mantener webhook de Mercado Pago sin auth
- **Archivo:** `src/server/routes/payment.routes.ts`

### Tarea 3.4: Simplificar `subscription.routes.ts`

- Mantener webhook de Stripe sin auth con raw body
- **Archivo:** `src/server/routes/subscription.routes.ts`

### Tarea 3.5: Simplificar rutas CRUD restantes

- `user.routes.ts`
- `product.routes.ts`
- `table.routes.ts`
- `menu-category.routes.ts`
- `menu-item.routes.ts`
- `expense.routes.ts`
- `refund.routes.ts`
- `employee-salary.routes.ts`
- `dashboard.routes.ts`
- `company.routes.ts`
- `report.routes.ts`

---

## Fase 4: Actualizar server y error handling global

> Dependencia: Fase 3 (el servidor necesita las rutas ya simplificadas)

### Tarea 4.1: Actualizar `server.ts`

- Reemplazar el error handler de Express existente por `expressErrorHandler`
- Eliminar el `ErrorHandlerMiddleware` viejo de `src/server/middleware/error-handler.middleware.ts`
- **Archivo:** `src/server/server.ts`

### Tarea 4.2: Actualizar `lambda.types.ts`

- Eliminar `ApiResponseHandler`, `LambdaHandler` y tipos Lambda
- Mantener solo `ApiResponse` si se usa en otros lados
- **Archivo:** `src/shared/types/lambda.types.ts`

---

## Fase 5: Limpieza de dependencias y archivos obsoletos

> Dependencia: Fases 1-4 completadas

### Tarea 5.1: Eliminar `HttpToLambdaAdapter`

- **Archivo:** `src/shared/utils/http-to-lambda.adapter.ts`

### Tarea 5.2: Eliminar dependencias Lambda/Middy de `package.json`

```
@middy/core
@middy/http-cors (no se usaba)
@middy/http-error-handler (no se usaba)
@middy/http-event-normalizer
@middy/http-json-body-parser
@middy/validator
@types/aws-lambda
```

### Tarea 5.3: Eliminar imports de `aws-lambda` residuales

- Buscar en todos los archivos por `from 'aws-lambda'` o `from '@middy'`
- Limpiar cualquier import restante

---

## Fase 6: Verificación

> Dependencia: Fase 5

### Tarea 6.1: Verificar compilación TypeScript

- `npm run build` debe pasar sin errores

### Tarea 6.2: Verificar endpoints de auth

- Login, logout, verify-user, set-password
- Cookies HttpOnly funcionando correctamente

### Tarea 6.3: Verificar endpoints CRUD

- Orders, payments, expenses, users, products, tables, etc.

### Tarea 6.4: Verificar webhooks

- Stripe webhook (raw body + signature verification)
- Mercado Pago webhook

### Tarea 6.5: Verificar WebSocket

- Conexión y desconexión funcionando
