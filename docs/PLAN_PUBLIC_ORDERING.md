# Plan de Implementación — Pedidos Online Públicos

> **Fecha:** 2026-04-10
> **Proyecto:** Restify (Backend + Frontend)
> **Objetivo:** Permitir que clientes del restaurante puedan ver el menú, hacer pedidos (domicilio o recolección) y pagar con Mercado Pago desde una vista pública sin login.

---

## Contexto Actual

- El POS interno permite crear órdenes con origen "Local", "Delivery" o "Para llevar".
- Los pagos con QR de Mercado Pago ya funcionan.
- Todas las rutas de órdenes y pagos requieren autenticación JWT + suscripción activa.
- El menú (platos, extras, categorías) ya existe en la BD.
- WebSocket ya notifica en tiempo real cuando hay cambios en órdenes.

### Qué se construye

Una vista pública (`/r/:slug` o `/menu`) donde el cliente:
1. Ve el menú del restaurante.
2. Agrega productos al carrito.
3. Elige: **Domicilio** (pone dirección en mapa) o **Recolección** (elige hora).
4. Ingresa nombre y teléfono.
5. Paga con Mercado Pago.
6. Ve el estado de su pedido en un link de seguimiento.

---

## Fase 1 — Modelo de Datos

### 1.1 Agregar campos a `Order`

```prisma
model Order {
  // ... campos existentes ...
  customerName     String?   // Nombre del cliente público
  customerPhone    String?   // Teléfono del cliente
  latitude         Float?    // Coordenadas para domicilio
  longitude        Float?    // Coordenadas para domicilio
  deliveryAddress  String?   @db.Text  // Dirección de referencia
  scheduledAt      DateTime? // Hora programada de entrega/recolección
  trackingToken    String?   @unique   // Token UUID para link de seguimiento público
  deliveryStatus   String?             // Estado de entrega: PENDING_PAYMENT, PAID, PREPARING, READY, ON_THE_WAY, DELIVERED

  @@map("orders")
}
```

### 1.2 Hacer `userId` nullable en `Order`

Cambiar `userId` de required a opcional en el schema de Prisma:

```prisma
model Order {
  // Antes: userId String
  userId  String?   // Nullable — las órdenes públicas no tienen usuario asignado
  user    User?     @relation(fields: [userId], references: [id])
}
```

Esto implica:
- Actualizar la entidad `Order` (`userId: string | null`).
- Actualizar el DTO de creación (`userId` pasa a ser opcional).
- Actualizar el `CreateOrderUseCase` para no validar `userId` si es null.
- Actualizar reportes/queries que filtren por usuario para manejar null.

> **No se crea un usuario "fantasma".** Las órdenes públicas simplemente no tienen usuario. Los reportes de ventas por usuario no se contaminan con datos falsos.

### 1.3 Actualizar entidad, repositorio e interfaces

Agregar todos los nuevos campos a la entidad `Order`, al DTO de creación, y al repositorio.

### Checklist Fase 1

- [ ] Agregar campos al schema de Prisma (customer, coordenadas, tracking, scheduledAt).
- [ ] Hacer `userId` nullable en schema de Prisma.
- [ ] Actualizar entidad `Order`.
- [ ] Actualizar DTOs y repositorio.
- [ ] Actualizar `CreateOrderUseCase` para permitir `userId` null.
- [ ] Verificar que reportes manejen `userId` null correctamente.
- [ ] Sincronizar BD.

---

## Fase 2 — Endpoints Públicos (Backend)

### 2.1 Crear rutas públicas

**Archivo:** `src/server/routes/public.routes.ts`

```typescript
const router = Router();

// Sin auth, CON validación de suscripción
router.get('/menu', listPublicMenuController);
router.get('/menu/categories', listPublicCategoriesController);
router.post('/orders', createPublicOrderController);
router.post('/orders/:orderId/pay', payPublicOrderController);
router.get('/orders/:trackingToken/status', getPublicOrderStatusController);

export default router;
```

### 2.2 Registrar en `routes/index.ts`

```typescript
// Sin auth, CON validación de suscripción
router.use('/api/public', SubscriptionMiddleware.validateSubscription, publicRoutes);
```

> Las rutas públicas pasan por el middleware de suscripción pero NO por auth. Si la suscripción del restaurante venció, el cliente ve un mensaje de "no disponible".

### 2.3 Crear use cases públicos

**ListPublicMenuUseCase:**
- Retorna menú items activos (`status: true, isExtra: false`) agrupados por categoría.
- Incluye extras activos (`status: true, isExtra: true`) por separado.
- No requiere `userId`.

**CreatePublicOrderUseCase:**
- Recibe: items del carrito, datos del cliente (nombre, teléfono), tipo (domicilio/recolección), dirección/coordenadas, hora programada.
- `userId` se envía como `null` — la orden no tiene usuario asignado.
- Genera `trackingToken` (UUID) para seguimiento.
- Origin: `"online-delivery"` o `"online-pickup"`.
- **No valida horario de operación** (o valida solo si hay `scheduledAt`).
- Valida que los items y extras existan y estén activos.

```typescript
interface CreatePublicOrderInput {
  customerName: string;
  customerPhone: string;
  orderType: 'DELIVERY' | 'PICKUP';
  deliveryAddress?: string;
  latitude?: number;
  longitude?: number;
  scheduledAt?: string;  // ISO date
  items: {
    menuItemId: string;
    quantity: number;
    note?: string;
    extras?: { extraId: string; quantity: number }[];
  }[];
}
```

**PayPublicOrderUseCase:**
- Recibe `orderId` del response de creación.
- Crea preferencia de MP igual que el flujo actual de QR.
- Retorna `initPoint` (link de pago de MP) para redirigir al cliente.
- No requiere `userId` — la orden ya se creó sin usuario.

**GetPublicOrderStatusUseCase:**
- Busca orden por `trackingToken`.
- Retorna: estado de pago, estado de entrega, items resumidos, hora estimada.
- No expone datos internos (userId, paymentMethod details, etc.).

```typescript
interface PublicOrderStatus {
  trackingToken: string;
  status: 'PENDING_PAYMENT' | 'PAID' | 'PREPARING' | 'READY' | 'ON_THE_WAY' | 'DELIVERED';
  customerName: string;
  orderType: 'DELIVERY' | 'PICKUP';
  scheduledAt: string | null;
  items: { name: string; quantity: number; total: number }[];
  total: number;
  createdAt: string;
}
```

### Checklist Fase 2

- [ ] Crear `public.routes.ts` con middleware de suscripción.
- [ ] Registrar `/api/public` en routes index.
- [ ] Crear `ListPublicMenuUseCase`.
- [ ] Crear `CreatePublicOrderUseCase`.
- [ ] Crear `PayPublicOrderUseCase`.
- [ ] Crear `GetPublicOrderStatusUseCase`.
- [ ] Crear controllers para cada endpoint.
- [ ] Validar inputs con zod.
- [ ] Tests unitarios.

---

## Fase 3 — Webhook y Notificaciones (Backend)

### 3.1 Notificar al POS cuando llega un pedido online

Cuando se confirma el pago via webhook de MP:
1. El `ConfirmMercadoPagoPaymentUseCase` ya actualiza el status de la orden.
2. Agregar: emitir evento WebSocket `order:new-online` con los datos de la orden.
3. El POS muestra una notificación/sonido de "Nuevo pedido online".

### 3.2 Actualizar estado de entrega

Agregar endpoint autenticado (para el admin/repartidor):

```typescript
PUT /api/orders/:orderId/delivery-status
Body: { status: 'PREPARING' | 'READY' | 'ON_THE_WAY' | 'DELIVERED' }
```

El cliente que esté viendo el link de seguimiento recibe la actualización.

### Checklist Fase 3

- [ ] Emitir WebSocket event en pago confirmado de orden online.
- [ ] Crear endpoint para actualizar estado de entrega.
- [ ] El frontend del POS escucha y muestra notificación de nuevo pedido online.

---

## Fase 4 — Frontend: Vista Pública del Menú

### 4.1 Layout público

**Ruta:** `/menu` (o `/r/:slug` cuando sea SaaS)

Un layout independiente sin sidebar, sin auth, sin MainLayout. Solo:
- Header con logo y nombre del restaurante.
- Contenido principal.
- Carrito flotante (bottom sheet en móvil).

### 4.2 Página del menú

**Componentes reutilizados del POS interno** (ya existen, reciben datos por props, sin dependencias de auth ni stores):
- `ProductGrid` — grilla de productos con imagen, nombre, precio y botón "Agregar".
- `CategoryFilter` — tabs/pills de categorías con scroll horizontal.
- `Cart` — componente de carrito con items, extras, totales y botón eliminar.
- `ExtrasSelectionDialog` — dialog para personalizar extras del producto.

**Lo que se crea nuevo:**
- `PublicMenuPage` — página que consume `GET /api/public/menu`, maneja estado local (categoría seleccionada, carrito, producto seleccionado) y renderiza los componentes existentes pasándoles datos como props.
- Servicio/hook para llamar al endpoint público sin auth.

### 4.3 Componente de mapa (Leaflet)

**Librería:** `react-leaflet` (gratuito, open source, sin API key)

- Aparece solo cuando el cliente elige "Domicilio".
- Mapa centrado en la ubicación del restaurante (configurable en Company).
- El cliente puede mover un pin o el navegador detecta su ubicación.
- Devuelve `lat`, `lng` y la dirección inversa (opcional).

### Checklist Fase 4

- [ ] Crear layout público sin sidebar/auth.
- [ ] Crear `PublicMenuPage` que orqueste los componentes existentes con datos de `/api/public/menu`.
- [ ] Crear servicio/hook para consumir endpoints públicos sin auth.
- [ ] Crear componente de mapa con Leaflet.
- [ ] Agregar ruta `/menu` en App.tsx (pública).

---

## Fase 5 — Frontend: Checkout y Pago

### 5.1 Página de checkout

**Flujo:**
1. Cliente ve resumen del carrito (reutiliza componente `Cart` en modo `readOnly`).
2. Ingresa: nombre, teléfono.
3. Elige tipo: "Domicilio" o "Recoger en local".
4. Si domicilio: mapa + dirección.
5. Si recolección: selector de fecha/hora.
6. Botón "Pagar con Mercado Pago" (único método de pago — no se usa `OrderPaymentLayout` del POS porque ese maneja efectivo, tarjeta, split, etc.).

### 5.2 Flujo de pago

1. Frontend llama `POST /api/public/orders` → recibe `orderId` y `trackingToken`.
2. Frontend llama `POST /api/public/orders/:orderId/pay` → recibe `initPoint` de MP.
3. Redirige al cliente a `initPoint` (página de pago de MP).
4. MP redirige de vuelta a la URL de éxito con el `trackingToken`.
5. Cliente ve la página de seguimiento.

### 5.3 Página de seguimiento

**Ruta:** `/pedido/:trackingToken`

- Muestra estado del pedido (con iconos de progreso).
- Polling cada 15 segundos a `GET /api/public/orders/:trackingToken/status`.
- Estados: Esperando pago → Pagado → Preparando → Listo → En camino → Entregado.
- Si es domicilio: botón "Ver en mapa" que abre Google Maps con la dirección del restaurante → cliente (para que el cliente sepa de dónde viene).

### Checklist Fase 5

- [ ] Crear página de checkout con formulario (nombre, teléfono, tipo, dirección/hora).
- [ ] Integrar mapa Leaflet en checkout (domicilio).
- [ ] Integrar selector de fecha/hora (recolección).
- [ ] Botón "Pagar con Mercado Pago" + redirect a `initPoint`.
- [ ] Crear página de seguimiento con polling.
- [ ] Agregar rutas públicas en App.tsx.

---

## Fase 6 — POS: Recibir Pedidos Online

### 6.1 Indicador en el panel de órdenes

- Las órdenes con origin `"online-delivery"` u `"online-pickup"` tienen un badge especial.
- Notificación sonora cuando llega un pedido online.

### 6.2 Detalle de orden online

En el `OrderDetailDialog`, mostrar:
- Nombre y teléfono del cliente.
- Tipo: Domicilio o Recolección.
- Si domicilio: dirección + botón "Abrir en Maps" (`https://www.google.com/maps/dir/?api=1&destination=lat,lng`).
- Si recolección: hora programada.

### 6.3 Gestión de estado de entrega

Agregar botones en el detalle de la orden para cambiar estado:
- "Preparando" → "Listo" → "En camino" → "Entregado".
- Cada cambio actualiza el endpoint y el cliente lo ve en su página de seguimiento.

### Checklist Fase 6

- [ ] Badge de "Pedido online" en OrderCard.
- [ ] Sonido de notificación para pedidos online.
- [ ] Datos del cliente en OrderDetailDialog.
- [ ] Botón "Abrir en Maps" para domicilio.
- [ ] Botones de estado de entrega.
- [ ] Filtro de órdenes por origin online.

---

## Orden de Implementación

```
Fase 1 (Modelo de datos) → Campos en Order + usuario público
  │
  ├── Fase 2 (Endpoints públicos) → API sin auth
  │
  ├── Fase 3 (Webhooks + notificaciones) → POS recibe alertas
  │
  ├── Fase 4 (Frontend: menú público) → Vista del cliente
  │
  ├── Fase 5 (Frontend: checkout + pago) → Flujo de compra
  │
  └── Fase 6 (POS: recibir pedidos) → Panel del restaurante
```

---

## Dependencias Externas

| Dependencia | Uso | Costo |
|-------------|-----|-------|
| `react-leaflet` + `leaflet` | Mapa para dirección de domicilio | Gratis (open source) |
| Mercado Pago | Pago del pedido (ya integrado) | Comisión por transacción |
| OpenStreetMap tiles | Tiles del mapa en Leaflet | Gratis |

---

## Consideraciones de Seguridad

- **Sin auth pero con suscripción**: Las rutas públicas validan que el restaurante tenga suscripción activa.
- **Rate limiting**: Las rutas públicas deben tener rate limiting más estricto que las internas (evitar abuso).
- **trackingToken**: UUID v4, imposible de adivinar. Es la única forma de ver el estado de un pedido.
- **Sin datos sensibles**: El endpoint de status público no expone userId, paymentMethod details, ni datos internos.
- **Validación de items**: El use case valida que los items existan y estén activos antes de crear la orden.
- **Pago obligatorio**: La orden se crea pero no se procesa hasta que MP confirme el pago. El restaurante solo ve órdenes pagadas.

---

## Notas

- **No se requiere login del cliente.** Nombre y teléfono se guardan en la orden directamente. `userId` es null en órdenes públicas.
- **El mapa es opcional.** Si el cliente no pone pin, puede escribir la dirección como texto.
- **La hora programada es opcional.** Si no la pone, el pedido es para "lo antes posible".
- **El flujo de pago usa redirect a MP**, no QR. El cliente en su celular abre el link de MP, paga, y MP lo redirige de vuelta.
- **Sin carrito persistente en servidor.** El carrito vive en localStorage del cliente. Solo se envía al backend al hacer checkout.
- **Compatible con SaaS futuro.** Cuando se implemente multi-tenancy, la ruta cambia de `/menu` a `/r/:slug` y se agrega la capa de routing por tenant.

---

## Mejoras Pendientes

### 1. Validación Zod en rutas públicas

**Problema:** Las rutas `POST /api/public/orders` y `POST /api/public/orders/:orderId/pay` no tienen middleware `zodValidator`. El body llega sin sanitizar directo al use case. Un request malformado (campos faltantes, tipos incorrectos) genera errores internos en vez de un 400 limpio.

**Solución:** Crear schemas Zod para los inputs públicos (`createPublicOrderSchema`, `payPublicOrderSchema`) y agregar `zodValidator` en `public.routes.ts`, igual que las rutas internas.

### 2. Rate limiting en rutas públicas

**Problema:** Las rutas públicas no tienen rate limiting. Un bot podría crear miles de órdenes o hacer polling masivo al endpoint de status.

**Solución:** Agregar middleware de rate limiting específico para `/api/public` con límites más estrictos que las rutas internas. Ejemplo: 10 req/min para `POST /orders`, 30 req/min para `GET /menu`, 60 req/min para `GET /status`.

### 3. Transacción atómica en CreatePublicOrderUseCase

**Problema:** La creación de orden, items y extras se hace con llamadas separadas al repositorio. Si falla a mitad de crear items (ej. error de BD), la orden queda con items parciales sin forma de limpiar.

**Solución:** Envolver la creación de orden + items + extras en una transacción de Prisma (`prisma.$transaction`), similar a como lo hace `CreateOrderUseCase` del POS. Si algo falla, se hace rollback completo.

### 4. Validación de datos del cliente

**Problema:** `customerName` y `customerPhone` no se validan en el use case. Pueden venir vacíos, con caracteres inválidos, o con formato de teléfono incorrecto. La validación debería estar en el schema Zod (punto 1), pero el use case tampoco valida como segunda capa.

**Solución:** El schema Zod debería validar: `customerName` min 1 char, max 200; `customerPhone` regex de formato telefónico (10-13 dígitos). No es necesario validar en el use case si Zod lo cubre.

### 5. Límite de cantidad por item

**Problema:** No hay límite en la cantidad de un item. Un usuario podría pedir 999999 unidades de un producto, generando una orden con total absurdo.

**Solución:** Validar en el schema Zod que `quantity` sea max 99 (o el límite que tenga sentido para el negocio). También se puede agregar un límite máximo de items por orden (ej. 50).

### 6. Bloqueo de entrega después de DELIVERED

**Problema:** Una vez que una orden se marca como DELIVERED, el `UpdateDeliveryStatusUseCase` permite cambiar el estado de vuelta (ej. a PREPARING). No hay validación que bloquee cambios post-entrega.

**Solución:** Agregar validación en `UpdateDeliveryStatusUseCase`: si `order.delivered === true`, lanzar `AppError('ORDER_ALREADY_DELIVERED')`.

### Prioridad sugerida

| # | Mejora | Impacto | Esfuerzo | Estado |
|---|--------|---------|----------|--------|
| 1 | Validación Zod | Alto (seguridad) | Bajo | Hecho |
| 2 | Rate limiting | Alto (abuso) | Bajo | Hecho |
| 3 | Transacción atómica | Alto (integridad) | Medio | Hecho |
| 6 | Bloqueo post-entrega | Medio (lógica) | Bajo | Hecho |
| 4 | Validación cliente | Medio (UX) | Bajo | Cubierto por #1 |
| 5 | Límite cantidad | Bajo (edge case) | Bajo | Cubierto por #1 |
| 7 | Validación horario de operación | Alto (lógica) | Bajo | Hecho |

---

## Mejoras Críticas Pendientes (Post-Auditoría)

Identificadas después de auditoría completa del flujo. Priorizadas para contexto de restaurante pequeño con BD y deploy propio.

### 7. Race condition en checkout (Frontend)

**Problema:** En `PublicCheckoutPage`, si `payOrder` falla después de guardar el `trackingToken` en localStorage, el token queda stale. Cuando MP redirige de vuelta, `PaymentResultPage` lee el token y redirige a una página de tracking de una orden que nunca se pagó.

**Flujo actual:**
```
1. createOrder → OK, recibe trackingToken
2. localStorage.setItem('publicOrderTrackingToken', token)  ← se guarda aquí
3. payOrder → FALLA (error de MP, timeout, etc.)
4. catch → muestra toast de error
5. Token queda en localStorage sin limpiar
```

**Solución:**
- En el `catch` del `handlePayWithMP`, limpiar el token: `localStorage.removeItem('publicOrderTrackingToken')`
- Opcionalmente, mover el `setItem` después de `payOrder` y antes del redirect, usando un micro-delay para asegurar persistencia

**Archivos:** `Restify-Frontend/src/presentation/pages/public-checkout/PublicCheckoutPage.tsx`
**Esfuerzo:** Bajo (1 línea en el catch)

### 8. Limpieza de órdenes huérfanas (Backend)

**Problema:** Cuando un cliente crea una orden pero nunca completa el pago (abandona el checkout, cierra el navegador, etc.), la orden queda con `status: false` en la BD para siempre. Con el tiempo se acumulan y contaminan el listado de órdenes y los reportes del admin.

**Impacto:** Órdenes fantasma en el panel del restaurante. Confusión al ver órdenes "pendientes" que nadie va a pagar.

**Solución:** Crear un job/cron que periódicamente (cada hora) busque órdenes con:
- `status = false` (no pagadas)
- `origin IN ('online-delivery', 'online-pickup')` (solo públicas)
- `createdAt < NOW() - INTERVAL 24 HOURS` (más de 24h sin pagar)

Y las marque como canceladas o las elimine.

**Alternativa simple:** No crear un cron — filtrar en el listado de órdenes del admin para excluir órdenes públicas no pagadas con más de 24h. Así no se ven en el panel pero quedan en la BD como historial.

**Archivos:** Nuevo use case `CleanupStaleOrdersUseCase` + cron job o filtro en `ListOrdersUseCase`
**Esfuerzo:** Medio

### 9. Validación de `scheduledAt` en el pasado (Backend)

**Problema:** El `CreatePublicOrderUseCase` valida que `scheduledAt` esté dentro del horario de operación, pero no valida que no sea una fecha pasada. Un cliente puede programar un pickup para ayer.

**Solución:** Agregar validación antes de la verificación de horario:
```typescript
if (input.scheduledAt) {
  const scheduled = new Date(input.scheduledAt);
  if (scheduled < new Date()) {
    throw new AppError('VALIDATION_ERROR', 'No se puede programar un pedido en el pasado');
  }
}
```

**Archivos:** `Restify-API/src/core/application/use-cases/orders/create-public-order.use-case.ts`
**Esfuerzo:** Bajo (5 líneas)

### 10. Polling no se detiene después de DELIVERED (Frontend)

**Problema:** La página de tracking (`PublicOrderTrackingPage`) hace polling cada 15 segundos al endpoint de status, incluso después de que la orden fue entregada. Es tráfico innecesario al backend.

**Solución:** Cambiar el `refetchInterval` para que sea condicional:
```typescript
refetchInterval: data?.status === 'DELIVERED' || data?.status === 'READY' && data?.orderType === 'PICKUP' ? false : 15000,
```
Para delivery: parar en DELIVERED.
Para pickup: parar en READY (último estado visible).

**Archivos:** `Restify-Frontend/src/presentation/pages/public-tracking/PublicOrderTrackingPage.tsx`
**Esfuerzo:** Bajo (1 línea)

### Prioridad de mejoras críticas

| # | Mejora | Impacto | Esfuerzo |
|---|--------|---------|----------|
| 7 | Race condition checkout | Alto (UX rota) | Bajo |
| 9 | scheduledAt en pasado | Alto (lógica) | Bajo |
| 10 | Polling post-entrega | Medio (performance) | Bajo |
| 8 | Órdenes huérfanas | Medio (datos basura) | Medio |
