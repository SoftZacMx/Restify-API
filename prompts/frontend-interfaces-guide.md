# Guía de Interfaces Frontend - API de Órdenes

Este documento describe las interfaces TypeScript/JavaScript que el frontend debe implementar para interactuar correctamente con el backend de órdenes.

## 📋 Índice

1. [Interfaces de Request (Envío al Backend)](#interfaces-de-request)
2. [Interfaces de Response (Respuesta del Backend)](#interfaces-de-response)
3. [Validaciones y Reglas de Negocio](#validaciones-y-reglas-de-negocio)
4. [Ejemplos Completos](#ejemplos-completos)

---

## Interfaces de Request

### 1. CreateOrderRequest

Interfaz para crear una nueva orden.

```typescript
interface CreateOrderRequest {
  userId: string;                    // UUID - REQUERIDO
  paymentMethod?: number;             // 1: Efectivo, 2: Transferencia, 3: Tarjeta (default: 1)
  tableId?: string | null;            // UUID - Opcional (null si es delivery)
  tip?: number;                       // Default: 0, mínimo: 0
  origin: string;                     // REQUERIDO - "Local", "Delivery", "Order", etc. (máx 50 caracteres)
  client?: string | null;             // Nombre del cliente (máx 200 caracteres)
  paymentDiffer?: boolean;            // Si el pago es diferido (default: false)
  note?: string | null;               // Nota general de la orden (máx 1000 caracteres)
  orderItems: OrderItemRequest[];     // REQUERIDO - Mínimo 1 item
}

interface OrderItemRequest {
  itemId: string;                     // UUID - REQUERIDO - ID del item seleccionado del menú
  quantity: number;                   // REQUERIDO - Entero positivo
  price: number;                      // REQUERIDO - Positivo, máximo 2 decimales
  note?: string | null;               // Nota específica del item (máx 500 caracteres)
  extras?: OrderItemExtraRequest[];   // Array de extras (opcional, puede estar vacío)
}

interface OrderItemExtraRequest {
  extraId: string;                    // UUID - REQUERIDO - Debe ser un MenuItem con isExtra: true
  quantity?: number;                   // Entero positivo (default: 1)
  price: number;                      // REQUERIDO - Positivo, máximo 2 decimales
}
```

**Reglas de Validación:**
- `orderItems` debe tener al menos 1 elemento
- `itemId` debe ser un UUID válido de un item del menú
- `extras` solo aplican si el item seleccionado es un platillo (no un producto genérico)
- `extraId` debe referenciar un `MenuItem` con `isExtra: true`

---

## Interfaces de Response

### 1. CreateOrderResponse

Respuesta al crear una orden.

```typescript
interface CreateOrderResponse {
  id: string;                         // UUID de la orden creada
  date: string;                       // ISO 8601 date string
  status: boolean;                    // false = no pagada, true = pagada
  paymentMethod: number | null;       // 1: Efectivo, 2: Transferencia, 3: Tarjeta, null: split payment
  total: number;                      // Total calculado por backend (subtotal + iva + tip)
  subtotal: number;                   // Subtotal calculado por backend (items + extras)
  iva: number;                         // IVA calculado por backend (16% del subtotal)
  delivered: boolean;                  // false = no entregada, true = entregada
  tableId: string | null;             // UUID de la mesa o null
  tip: number;                        // Propina
  origin: string;                     // Origen de la orden
  client: string | null;              // Nombre del cliente o null
  paymentDiffer: boolean;            // Si el pago es diferido
  note: string | null;               // Nota general de la orden
  userId: string;                     // UUID del usuario que creó la orden
  createdAt: string;                  // ISO 8601 date string
  updatedAt: string;                  // ISO 8601 date string
  orderItems?: OrderItemResponse[];   // Array de items de la orden
}

interface OrderItemResponse {
  id: string;                         // UUID del order item
  quantity: number;
  price: number;
  itemId: string;                     // UUID del item seleccionado del menú
  note: string | null;                // Nota del item
  createdAt: string;                  // ISO 8601 date string
  updatedAt: string;                  // ISO 8601 date string
  extras?: OrderItemExtraResponse[];  // Array de extras agrupados por este item
}

interface OrderItemExtraResponse {
  id: string;                         // UUID del extra
  extraId: string;                    // UUID del MenuItem (extra)
  quantity: number;
  price: number;                      // Precio snapshot al momento de la orden
  createdAt: string;                  // ISO 8601 date string
  updatedAt: string;                  // ISO 8601 date string
}
```

### 2. GetOrderResponse

Respuesta al obtener una orden (misma estructura que CreateOrderResponse).

```typescript
interface GetOrderResponse {
  // Misma estructura que CreateOrderResponse
  // Los extras vienen agrupados por orderItemId
}
```

### 3. UpdateOrderResponse

Respuesta al actualizar una orden (misma estructura que CreateOrderResponse).

```typescript
interface UpdateOrderResponse {
  // Misma estructura que CreateOrderResponse
}
```

### 4. UpdateOrderRequest

Interfaz para actualizar una orden (solo campos opcionales).

```typescript
interface UpdateOrderRequest {
  status?: boolean;                   // Estado de pago
  paymentMethod?: number | null;      // Método de pago (puede ser null para split payments)
  delivered?: boolean;                // Estado de entrega
  tip?: number;                       // Propina
  origin?: string;                     // Origen (máx 50 caracteres)
  client?: string | null;             // Cliente (máx 200 caracteres)
  paymentDiffer?: boolean;            // Pago diferido
  note?: string | null;               // Nota (máx 1000 caracteres)
  tableId?: string | null;            // UUID de la mesa
}
```

**Nota:** La actualización de orden NO permite modificar `orderItems` ni `extras`. Solo se pueden actualizar los campos de la orden principal.

---

## Validaciones y Reglas de Negocio

### Validaciones del Frontend (antes de enviar)

1. **OrderItems:**
   - Debe tener al menos 1 item
   - `itemId` debe ser un UUID válido de un item del menú
   - `quantity` debe ser entero positivo
   - `price` debe ser positivo con máximo 2 decimales

2. **Extras:**
   - Solo pueden agregarse a items que sean platillos (el backend valida si el item permite extras)
   - `extraId` debe referenciar un `MenuItem` con `isExtra: true`
   - `quantity` debe ser entero positivo (default: 1)
   - `price` debe ser positivo con máximo 2 decimales

3. **Campos de Orden:**
   - `userId`: UUID válido, requerido
   - `origin`: String no vacío, máximo 50 caracteres
   - `tableId`: UUID válido o null
   - `tip`: Número no negativo, máximo 2 decimales
   - `note`: Máximo 1000 caracteres

### Cálculos del Backend (fuente de verdad)

**IMPORTANTE:** El frontend puede calcular totales para mostrar al usuario, pero el backend SIEMPRE recalcula y devuelve los valores correctos. El frontend debe usar los valores del backend como fuente de verdad.

**Fórmulas del Backend:**
```
subtotal = Σ(orderItem.price × orderItem.quantity) + Σ(extra.price × extra.quantity)
iva = subtotal × 0.16
total = subtotal + iva + tip
```

**Recomendación:**
- Frontend calcula para UX (feedback inmediato)
- Backend calcula y valida (fuente de verdad)
- Frontend usa los valores del backend en la respuesta

---

## Ejemplos Completos

### Ejemplo 1: Crear Orden Completa (Request)

```json
{
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "paymentMethod": 1,
  "tableId": "123e4567-e89b-12d3-a456-426614174001",
  "tip": 50.00,
  "origin": "Local",
  "client": "Juan Pérez",
  "paymentDiffer": false,
  "note": "Sin cebolla en la hamburguesa",
  "orderItems": [
    {
      "itemId": "123e4567-e89b-12d3-a456-426614174002",
      "quantity": 2,
      "price": 150.00,
      "note": "Bien cocida",
      "extras": [
        {
          "extraId": "123e4567-e89b-12d3-a456-426614174010",
          "quantity": 1,
          "price": 20.00
        },
        {
          "extraId": "123e4567-e89b-12d3-a456-426614174011",
          "quantity": 2,
          "price": 15.00
        }
      ]
    },
    {
      "itemId": "123e4567-e89b-12d3-a456-426614174004",
      "quantity": 3,
      "price": 25.00,
      "note": "Producto adicional",
      "extras": []
    }
  ]
}
```

### Ejemplo 2: Respuesta del Backend (Response)

```json
{
  "id": "order-123",
  "date": "2024-01-15T10:30:00.000Z",
  "status": false,
  "paymentMethod": 1,
  "total": 650.50,
  "subtotal": 560.50,
  "iva": 89.68,
  "delivered": false,
  "tableId": "123e4567-e89b-12d3-a456-426614174001",
  "tip": 50.00,
  "origin": "Local",
  "client": "Juan Pérez",
  "paymentDiffer": false,
  "note": "Sin cebolla en la hamburguesa",
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z",
  "orderItems": [
    {
      "id": "order-item-1",
      "quantity": 2,
      "price": 150.00,
      "itemId": "123e4567-e89b-12d3-a456-426614174002",
      "note": "Bien cocida",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z",
      "extras": [
        {
          "id": "extra-1",
          "extraId": "123e4567-e89b-12d3-a456-426614174010",
          "quantity": 1,
          "price": 20.00,
          "createdAt": "2024-01-15T10:30:00.000Z",
          "updatedAt": "2024-01-15T10:30:00.000Z"
        },
        {
          "id": "extra-2",
          "extraId": "123e4567-e89b-12d3-a456-426614174011",
          "quantity": 2,
          "price": 15.00,
          "createdAt": "2024-01-15T10:30:00.000Z",
          "updatedAt": "2024-01-15T10:30:00.000Z"
        }
      ]
    },
    {
      "id": "order-item-2",
      "quantity": 3,
      "price": 25.00,
      "itemId": "123e4567-e89b-12d3-a456-426614174004",
      "note": "Producto adicional",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z",
      "extras": []
    }
  ]
}
```

### Ejemplo 3: Orden Mínima (Request)

```json
{
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "origin": "Local",
  "orderItems": [
    {
      "itemId": "123e4567-e89b-12d3-a456-426614174002",
      "quantity": 1,
      "price": 100.00
    }
  ]
}
```

### Ejemplo 4: Orden con Delivery (sin mesa)

```json
{
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "paymentMethod": 2,
  "tableId": null,
  "tip": 0,
  "origin": "Delivery",
  "client": "María González",
  "paymentDiffer": false,
  "orderItems": [
    {
      "itemId": "123e4567-e89b-12d3-a456-426614174003",
      "quantity": 1,
      "price": 120.00,
      "extras": [
        {
          "extraId": "123e4567-e89b-12d3-a456-426614174012",
          "quantity": 1,
          "price": 10.00
        }
      ]
    }
  ]
}
```

---

## Endpoints y Métodos HTTP

### Crear Orden
- **Endpoint:** `POST /api/orders`
- **Autenticación:** Requerida (token en cookie o header Authorization)
- **Content-Type:** `application/json`
- **Request:** `CreateOrderRequest`
- **Response:** `CreateOrderResponse` (200 OK)

### Obtener Orden
- **Endpoint:** `GET /api/orders/:order_id`
- **Autenticación:** Requerida
- **Request:** Ninguno (order_id en URL)
- **Response:** `GetOrderResponse` (200 OK)

### Actualizar Orden
- **Endpoint:** `PUT /api/orders/:order_id`
- **Autenticación:** Requerida
- **Content-Type:** `application/json`
- **Request:** `UpdateOrderRequest`
- **Response:** `UpdateOrderResponse` (200 OK)

### Listar Órdenes
- **Endpoint:** `GET /api/orders?status=true&userId=...&tableId=...`
- **Autenticación:** Requerida
- **Request:** Query parameters opcionales
- **Response:** `GetOrderResponse[]` (200 OK)

### Eliminar Orden
- **Endpoint:** `DELETE /api/orders/:order_id`
- **Autenticación:** Requerida
- **Request:** Ninguno
- **Response:** 204 No Content

---

## Errores Comunes a Evitar

1. ❌ Enviar `itemId` inválido o que no exista en el menú
2. ❌ Enviar `extras` en items que no permiten extras (el backend valida)
3. ❌ Enviar `extraId` que no sea un MenuItem con `isExtra: true`
4. ❌ Confiar en los cálculos del frontend (usar siempre los del backend)
5. ❌ Enviar `orderItems` vacío
6. ❌ Enviar `quantity` o `price` negativos o cero
7. ❌ Enviar `tableId` cuando `origin` es "Delivery"

---

## Notas Importantes

1. **Fechas:** Todas las fechas vienen en formato ISO 8601 (string)
2. **UUIDs:** Todos los IDs son UUIDs v4 (string)
3. **Decimales:** Todos los precios tienen máximo 2 decimales
4. **Extras agrupados:** Los extras vienen agrupados por `orderItemId` en la respuesta
5. **Cálculos:** El backend siempre recalcula totales, no confíes en los del frontend
6. **Validación:** El backend valida todo, pero el frontend debe validar antes de enviar para mejor UX

---

## Tipos TypeScript Completos

```typescript
// Enums útiles
enum PaymentMethod {
  CASH = 1,
  TRANSFER = 2,
  CARD = 3
}

enum OrderOrigin {
  LOCAL = "Local",
  DELIVERY = "Delivery",
  ORDER = "Order"
}

// Interfaces principales (copiar y usar)
export interface CreateOrderRequest { /* ... ver arriba ... */ }
export interface OrderItemRequest { /* ... ver arriba ... */ }
export interface OrderItemExtraRequest { /* ... ver arriba ... */ }
export interface CreateOrderResponse { /* ... ver arriba ... */ }
export interface OrderItemResponse { /* ... ver arriba ... */ }
export interface OrderItemExtraResponse { /* ... ver arriba ... */ }
export interface UpdateOrderRequest { /* ... ver arriba ... */ }
export interface GetOrderResponse extends CreateOrderResponse {}
export interface UpdateOrderResponse extends CreateOrderResponse {}
```

---

**Última actualización:** 2024-01-15
**Versión del Backend:** Compatible con schema actual
