# Plan de Mejoras para Producción

## Contexto

Problemas reales encontrados en el backend que afectan dinero, datos o experiencia de usuario en producción. Ordenados por impacto.

---

## 1. CRITICO — Race condition en pagos (doble cobro)

**Problema:** Los use cases de pago (cash, transfer, card-physical) leen la orden, verifican que no esté pagada, crean el pago y actualizan la orden en operaciones separadas. Si dos requests llegan al mismo tiempo, ambos leen `status: false` y ambos crean un pago.

**Archivos afectados:**
- `src/core/application/use-cases/payments/pay-order-with-cash.use-case.ts`
- `src/core/application/use-cases/payments/pay-order-with-transfer.use-case.ts`
- `src/core/application/use-cases/payments/pay-order-with-card-physical.use-case.ts`

**Ejemplo del código actual:**
```typescript
// Paso 1: Lee orden (NO bloqueada)
const order = await this.orderRepository.findById(input.orderId);
if (order.status) throw new AppError('ORDER_ALREADY_PAID');

// Paso 2: Crea pago
const payment = await this.paymentRepository.create({ ... });

// Paso 3: Actualiza orden
await this.orderRepository.update(order.id, { status: true });

// Paso 4: Libera mesa
await this.tableRepository.update(order.tableId, { availabilityStatus: true });
```

**Solución:** Envolver todo en una transacción de Prisma con `SELECT ... FOR UPDATE` para bloquear la orden mientras se procesa:

```typescript
const result = await prisma.$transaction(async (tx) => {
  // Bloquea la orden — ningún otro request puede leerla hasta que termine
  const [order] = await tx.$queryRaw`SELECT * FROM orders WHERE id = ${input.orderId} FOR UPDATE`;
  
  if (order.status) throw new AppError('ORDER_ALREADY_PAID');

  const payment = await tx.payment.create({ ... });
  const updatedOrder = await tx.order.update({ where: { id: order.id }, data: { status: true } });
  
  if (order.tableId) {
    await tx.table.update({ where: { id: order.tableId }, data: { availabilityStatus: true } });
  }

  return { payment, order: updatedOrder };
});
```

**Impacto del cambio:**
- Requiere exponer `prisma.$transaction` al use case (via repositorio o servicio de transacciones)
- Se debe aplicar a los 3 use cases de pago directo + el use case unificado `pay-order.use-case.ts`
- Los use cases de Stripe y MP ya manejan esto parcialmente porque el pago se confirma vía webhook (asíncrono)

**Estimación:** ~2-3 horas

---

## 2. CRITICO — Creación de orden sin transacción

**Problema:** Crear una orden ejecuta múltiples operaciones de BD sin transacción:
1. Crear orden
2. Marcar mesa como no disponible
3. Crear cada order item (loop)
4. Crear cada extra de cada item (loop anidado)

Si falla en el paso 3 o 4, queda una orden incompleta en BD con la mesa bloqueada.

**Archivo afectado:**
- `src/core/application/use-cases/orders/create-order.use-case.ts` (líneas 154-203)

**Código actual (simplificado):**
```typescript
const order = await this.orderRepository.create({ ... });           // Paso 1
await this.tableRepository.update(tableId, { available: false });    // Paso 2
for (const item of input.orderItems) {                               // Paso 3
  const orderItem = await this.orderRepository.createOrderItem({ ... });
  for (const extra of item.extras) {                                 // Paso 4
    await this.orderRepository.createOrderItemExtra({ ... });
  }
}
```

**Solución:** Envolver en transacción de Prisma:

```typescript
const result = await prisma.$transaction(async (tx) => {
  const order = await tx.order.create({ ... });

  if (order.tableId) {
    // Bloquear mesa con FOR UPDATE para evitar doble reserva
    await tx.$queryRaw`SELECT * FROM tables WHERE id = ${order.tableId} FOR UPDATE`;
    await tx.table.update({ where: { id: order.tableId }, data: { availabilityStatus: false } });
  }

  for (const item of input.orderItems) {
    const orderItem = await tx.orderItem.create({ ... });
    for (const extra of item.extras) {
      await tx.orderItemExtra.create({ ... });
    }
  }

  return order;
});
// Si algo falla, TODO se revierte automáticamente
```

**Mismo problema aplica a:**
- `update-order.use-case.ts` — actualiza orden + items + extras sin transacción

**Estimación:** ~2-3 horas

---

## 3. ALTO — IVA hardcodeado a 0

**Problema:** En `create-order.use-case.ts` línea 151:
```typescript
const iva = 0;
const total = subtotal + (input.tip || 0);
```

El sistema nunca calcula impuestos. Los reportes muestran $0 de IVA recaudado.

**Archivo afectado:**
- `src/core/application/use-cases/orders/create-order.use-case.ts` (línea 151)
- `src/core/application/use-cases/orders/update-order.use-case.ts` (línea 158 si existe)

**Contexto:** El restaurante opera en México (Mercado Pago en MXN). El IVA en México es 16%.

**Solución:** Tomar el porcentaje de IVA de la configuración de la empresa (tabla `company`):

```typescript
const company = await this.companyRepository.findFirst();
const taxRate = company?.taxRate ?? 0; // 0.16 para México
const iva = subtotal * taxRate;
const total = subtotal + iva + (input.tip || 0);
```

**Requiere:**
1. Agregar campo `taxRate` (Decimal) a la tabla `company` en el schema de Prisma
2. Migración de BD
3. Actualizar `create-order` y `update-order` use cases
4. Actualizar el frontend para mostrar el desglose de IVA

**Decisión de negocio necesaria:** ¿El precio de los productos ya incluye IVA o se suma aparte? Esto cambia el cálculo:
- **IVA incluido:** `iva = subtotal - (subtotal / 1.16)` → total = subtotal + tip
- **IVA sumado:** `iva = subtotal * 0.16` → total = subtotal + iva + tip

**Estimación:** ~3-4 horas (backend + migración + frontend)

---

## 4. ALTO — WebSocket sin recuperación de sesión de pago

**Problema:** Si el WiFi se cae durante un pago con Stripe, el WebSocket se desconecta. Cuando reconecta, no hay forma de saber si el pago se completó. El usuario puede reintentar y cobrar doble.

**Archivos afectados:**
- `src/server/websocket/websocket.server.ts`
- `src/core/application/use-cases/payments/` (Stripe y MP)

**Solución:** Agregar un endpoint REST para consultar el estado de un pago por orderId:

```typescript
// GET /api/payments/status/:orderId
// Retorna el último estado de pago de la orden
// Si el pago se completó durante la desconexión del WS, el frontend lo sabe
```

El frontend al reconectar el WebSocket debe consultar este endpoint para sincronizar el estado. No requiere cambiar el WebSocket — solo agregar un endpoint de fallback.

**Estimación:** ~1 hora

---

## 5. MEDIO — N+1 queries en validación de orden

**Problema:** Al crear una orden, cada item y cada extra se valida individualmente con una query a BD:
```typescript
for (const item of input.orderItems) {
  const product = await this.productRepository.findById(item.productId);  // 1 query
  for (const extra of item.extras) {
    const extraItem = await this.menuItemRepository.findById(extra.extraId);  // 1 query
  }
}
```

Una orden de 10 items con 3 extras cada uno = 40 queries.

**Archivo afectado:**
- `src/core/application/use-cases/orders/create-order.use-case.ts` (líneas 113-147)

**Solución:** Validar en batch:

```typescript
// Extraer todos los IDs primero
const productIds = items.filter(i => i.productId).map(i => i.productId);
const menuItemIds = items.filter(i => i.menuItemId).map(i => i.menuItemId);
const extraIds = items.flatMap(i => i.extras.map(e => e.extraId));

// 3 queries en vez de 40
const products = await this.productRepository.findByIds(productIds);
const menuItems = await this.menuItemRepository.findByIds([...menuItemIds, ...extraIds]);

// Validar contra los resultados
if (products.length !== productIds.length) throw new AppError('PRODUCT_NOT_FOUND');
```

**Nota:** `findByIds` ya existe en las interfaces de `IProductRepository` y `IMenuItemRepository`.

**Estimación:** ~1-2 horas

---

## 6. MEDIO — Magic numbers en métodos de pago

**Problema:** Los use cases usan números mágicos para métodos de pago:
```typescript
paymentMethod: 1  // Cash
paymentMethod: 2  // Transfer
paymentMethod: 3  // Card
paymentMethod: 4  // QR MP
```

Existe el enum `PaymentMethod` en Prisma pero la orden guarda un entero, no el enum.

**Archivos afectados:**
- Todos los use cases de pago
- Schema de Prisma (campo `paymentMethod` en Order es `Int`)

**Solución:** Crear un mapa constante:

```typescript
export const PAYMENT_METHOD_CODE = {
  CASH: 1,
  TRANSFER: 2,
  CARD_PHYSICAL: 3,
  QR_MERCADO_PAGO: 4,
} as const;
```

Y reemplazar los números mágicos. Idealmente migrar la columna de `Int` a `PaymentMethod` enum, pero eso requiere migración de datos.

**Estimación:** ~1 hora (constantes) o ~3 horas (migración completa)

---

## 7. BAJO — Logs de debug en producción

**Problema:** Quedaron logs de debug con `TODO: Remover` en:
- `src/core/infrastructure/payment-gateways/mercado-pago.service.ts`

**Solución:** Eliminar los `console.log` marcados con TODO.

**Estimación:** 5 minutos

---

## Orden de implementación recomendado

| Prioridad | Mejora | Estimación | Dependencias |
|-----------|--------|------------|--------------|
| 1 | Logs de debug | 5 min | Ninguna |
| 2 | Race condition en pagos | 2-3h | Necesita servicio de transacciones |
| 3 | Creación de orden sin transacción | 2-3h | Mismo servicio de transacciones |
| 4 | Endpoint de estado de pago (WS fallback) | 1h | Ninguna |
| 5 | N+1 queries | 1-2h | Ninguna |
| 6 | IVA configurable | 3-4h | Decisión de negocio sobre cálculo |
| 7 | Magic numbers | 1h | Ninguna |

**Nota:** Los puntos 2 y 3 comparten la misma infraestructura (transacciones de Prisma). Conviene implementarlos juntos.
