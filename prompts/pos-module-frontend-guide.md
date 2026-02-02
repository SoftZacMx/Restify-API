# Guía Frontend - Módulo de Punto de Venta (POS)

Este documento describe las interfaces, endpoints, campos y flujos que el frontend debe implementar para el módulo de Punto de Venta (POS), asegurando compatibilidad total con el backend de Restify API.

## Índice

1. [Resumen del Módulo](#resumen-del-módulo)
2. [Autenticación](#autenticación)
3. [Mesas (Tables)](#mesas-tables)
4. [Categorías del Menú](#categorías-del-menú)
5. [Items del Menú](#items-del-menú)
6. [Productos](#productos)
7. [Órdenes](#órdenes)
8. [Pagos](#pagos)
9. [Reembolsos](#reembolsos)
10. [Enums y Constantes](#enums-y-constantes)
11. [Formato de Respuestas](#formato-de-respuestas)
12. [Flujos de Trabajo Completos](#flujos-de-trabajo-completos)
13. [WebSocket - Notificaciones en Tiempo Real](#websocket---notificaciones-en-tiempo-real)
14. [Manejo de Errores](#manejo-de-errores)

---

## Resumen del Módulo

El módulo de Punto de Venta permite:
- Gestionar mesas del restaurante
- Administrar el menú (categorías e items)
- Crear y gestionar órdenes
- Procesar pagos (efectivo, transferencia, tarjeta física, Stripe)
- Pagar órdenes (un solo endpoint: método, monto, opcional referencia de transferencia)
- Procesar reembolsos

**Base URL:** `http://localhost:3000/api`

**Autenticación:** Todas las rutas (excepto login) requieren JWT token via:
- Header `Authorization: Bearer <token>`
- Cookie HttpOnly `token`

---

## Autenticación

### Login

```typescript
// POST /api/auth/login/:rol
// Roles válidos: ADMIN, MANAGER, WAITER, CHEF

interface LoginRequest {
  email: string;     // REQUERIDO - Email válido
  password: string;  // REQUERIDO - Mínimo 6 caracteres
}

interface LoginResponse {
  success: boolean;
  data: {
    token: string;
    user: {
      id: string;
      name: string;
      last_name: string;
      second_last_name: string | null;
      email: string;
      phone: string | null;
      status: boolean;
      rol: UserRole;
      createdAt: string;
      updatedAt: string;
    };
  };
  timestamp: string;
}
```

**Ejemplo:**
```typescript
// Request
POST /api/auth/login/WAITER
{
  "email": "mesero@restify.com",
  "password": "password123"
}

// Response (200 OK)
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Juan",
      "last_name": "García",
      "email": "mesero@restify.com",
      "rol": "WAITER"
    }
  },
  "timestamp": "2026-01-24T12:00:00.000Z"
}
```

### Logout

```typescript
// POST /api/auth/logout
// No requiere body

interface LogoutResponse {
  success: boolean;
  data: {
    message: string;
  };
  timestamp: string;
}
```

### Verificar Usuario (Recuperación de Contraseña)

```typescript
// POST /api/auth/verify-user

interface VerifyUserRequest {
  email: string;  // REQUERIDO - Email del usuario
}
```

### Establecer Contraseña

```typescript
// POST /api/auth/set-password/:user_id

interface SetPasswordRequest {
  password: string;  // REQUERIDO - Nueva contraseña (mínimo 6 caracteres)
}
```

---

## Mesas (Tables)

### Interfaces

```typescript
// Respuesta de Mesa
interface TableResponse {
  id: string;                    // UUID
  numberTable: number;           // Número de la mesa
  userId: string;                // UUID del usuario que la creó
  status: boolean;               // true = activa, false = inactiva
  availabilityStatus: boolean;   // true = libre, false = ocupada
  createdAt: string;             // ISO 8601
  updatedAt: string;             // ISO 8601
}

// Crear Mesa
interface CreateTableRequest {
  numberTable: number;          // REQUERIDO - Entero positivo
  status?: boolean;             // Opcional (default: true)
  availabilityStatus?: boolean; // Opcional (default: true)
  userId: string;               // REQUERIDO - UUID del usuario
}

// Actualizar Mesa
interface UpdateTableRequest {
  numberTable?: number;          // Opcional
  status?: boolean;              // Opcional
  availabilityStatus?: boolean;  // Opcional
}

// Filtros para Listar
interface ListTablesQuery {
  status?: boolean;
  availabilityStatus?: boolean;
  userId?: string;
  numberTable?: number;
}
```

### Endpoints

| Operación | Método | Endpoint | Request | Response |
|-----------|--------|----------|---------|----------|
| Crear | `POST` | `/api/tables` | `CreateTableRequest` | `TableResponse` |
| Listar | `GET` | `/api/tables` | Query params | `TableResponse[]` |
| Obtener | `GET` | `/api/tables/:table_id` | - | `TableResponse` |
| Actualizar | `PUT` | `/api/tables/:table_id` | `UpdateTableRequest` | `TableResponse` |
| Eliminar | `DELETE` | `/api/tables/:table_id` | - | 204 No Content |

---

## Categorías del Menú

### Interfaces

```typescript
// Respuesta de Categoría
interface MenuCategoryResponse {
  id: string;         // UUID
  name: string;       // Nombre de la categoría
  status: boolean;    // true = activa
  createdAt: string;  // ISO 8601
  updatedAt: string;  // ISO 8601
}

// Crear Categoría
interface CreateMenuCategoryRequest {
  name: string;      // REQUERIDO - Máx 200 caracteres
  status?: boolean;  // Opcional (default: true)
}

// Actualizar Categoría
interface UpdateMenuCategoryRequest {
  name?: string;     // Opcional
  status?: boolean;  // Opcional
}

// Filtros para Listar
interface ListMenuCategoriesQuery {
  status?: boolean;
  search?: string;   // Búsqueda por nombre
}
```

### Endpoints

| Operación | Método | Endpoint | Request | Response |
|-----------|--------|----------|---------|----------|
| Crear | `POST` | `/api/menu-categories` | `CreateMenuCategoryRequest` | `MenuCategoryResponse` |
| Listar | `GET` | `/api/menu-categories` | Query params | `MenuCategoryResponse[]` |
| Obtener | `GET` | `/api/menu-categories/:category_id` | - | `MenuCategoryResponse` |
| Actualizar | `PUT` | `/api/menu-categories/:category_id` | `UpdateMenuCategoryRequest` | `MenuCategoryResponse` |
| Eliminar | `DELETE` | `/api/menu-categories/:category_id` | - | 204 No Content |

---

## Items del Menú

### Interfaces

```typescript
// Respuesta de Item del Menú
interface MenuItemResponse {
  id: string;              // UUID
  name: string;            // Nombre del platillo/item
  price: number;           // Precio (decimal, 2 decimales máx)
  status: boolean;         // true = activo
  isExtra: boolean;        // true = es un extra (complemento)
  categoryId: string | null;  // UUID de categoría (opcional)
  userId: string;          // UUID del usuario que lo creó
  createdAt: string;       // ISO 8601
  updatedAt: string;       // ISO 8601
  category?: MenuCategoryResponse;  // Categoría (cuando se incluye)
}

// Crear Item del Menú
interface CreateMenuItemRequest {
  name: string;                   // REQUERIDO - Máx 200 caracteres
  price: number;                  // REQUERIDO - Positivo, máx 2 decimales
  status?: boolean;               // Opcional (default: true)
  categoryId?: string | null;     // Opcional - UUID de categoría
  userId: string;                 // REQUERIDO - UUID del usuario
}

// Actualizar Item del Menú
interface UpdateMenuItemRequest {
  name?: string;
  price?: number;
  status?: boolean;
  categoryId?: string;
  userId?: string;
}

// Filtros para Listar
interface ListMenuItemsQuery {
  status?: boolean;
  categoryId?: string;
  userId?: string;
  search?: string;        // Búsqueda por nombre
}
```

### Endpoints

| Operación | Método | Endpoint | Request | Response |
|-----------|--------|----------|---------|----------|
| Crear | `POST` | `/api/menu-items` | `CreateMenuItemRequest` | `MenuItemResponse` |
| Listar | `GET` | `/api/menu-items` | Query params | `MenuItemResponse[]` |
| Obtener | `GET` | `/api/menu-items/:menu_item_id` | - | `MenuItemResponse` |
| Actualizar | `PUT` | `/api/menu-items/:menu_item_id` | `UpdateMenuItemRequest` | `MenuItemResponse` |
| Eliminar | `DELETE` | `/api/menu-items/:menu_item_id` | - | 204 No Content |

**Nota sobre Extras:** Los items con `isExtra: true` son complementos que pueden agregarse a otros items en una orden.

---

## Productos

### Interfaces

```typescript
// Respuesta de Producto
interface ProductResponse {
  id: string;              // UUID
  name: string;            // Nombre del producto
  description: string | null;  // Descripción opcional
  status: boolean;         // true = activo
  registrationDate: string; // Fecha de registro
  userId: string;          // UUID del usuario que lo creó
  createdAt: string;       // ISO 8601
  updatedAt: string;       // ISO 8601
}

// Crear Producto
interface CreateProductRequest {
  name: string;                    // REQUERIDO - Máx 200 caracteres
  description?: string | null;     // Opcional - Máx 1000 caracteres
  status?: boolean;                // Opcional (default: true)
  userId: string;                  // REQUERIDO - UUID del usuario
}

// Actualizar Producto
interface UpdateProductRequest {
  name?: string;
  description?: string | null;
  status?: boolean;
}

// Filtros para Listar
interface ListProductsQuery {
  status?: boolean;
  userId?: string;
  search?: string;         // Búsqueda por nombre
}
```

### Endpoints

| Operación | Método | Endpoint | Request | Response |
|-----------|--------|----------|---------|----------|
| Crear | `POST` | `/api/products` | `CreateProductRequest` | `ProductResponse` |
| Listar | `GET` | `/api/products` | Query params | `ProductResponse[]` |
| Obtener | `GET` | `/api/products/:product_id` | - | `ProductResponse` |
| Actualizar | `PUT` | `/api/products/:product_id` | `UpdateProductRequest` | `ProductResponse` |
| Eliminar | `DELETE` | `/api/products/:product_id` | - | 204 No Content |

---

## Órdenes

### Interfaces

```typescript
// Extra en un item de orden
interface OrderItemExtraInput {
  extraId: string;    // REQUERIDO - UUID del MenuItem con isExtra: true
  quantity?: number;  // Opcional (default: 1) - Cantidad del extra
  price: number;      // REQUERIDO - Precio del extra (positivo, máx 2 decimales)
}

// Item de Orden (para crear/actualizar)
interface OrderItemInput {
  productId?: string | null;   // UUID del producto (uno de los dos es requerido)
  menuItemId?: string | null;  // UUID del item del menú (uno de los dos es requerido)
  quantity: number;            // REQUERIDO - Entero positivo
  price: number;               // REQUERIDO - Precio (positivo, máx 2 decimales)
  note?: string | null;        // Opcional - Nota del item (máx 500 caracteres)
  extras?: OrderItemExtraInput[];  // Opcional - Extras para este item
}

// Crear Orden
interface CreateOrderRequest {
  paymentMethod?: number;        // Opcional (default: 1) - 1: Cash, 2: Transfer, 3: Card
  tableId?: string | null;       // Opcional - UUID de la mesa
  tip?: number;                  // Opcional (default: 0) - Propina
  origin: string;                // REQUERIDO - Origen: 'Local', 'Delivery', 'Order', etc. (máx 50 chars)
  client?: string | null;        // Opcional - Nombre del cliente (máx 200 chars)
  paymentDiffer?: boolean;       // Opcional (default: false) - Pago diferido
  note?: string | null;          // Opcional - Nota de la orden (máx 1000 chars)
  userId: string;                // REQUERIDO - UUID del usuario (mesero)
  orderItems: OrderItemInput[];  // REQUERIDO - Mínimo 1 item
}

// Actualizar Orden
interface UpdateOrderRequest {
  status?: boolean;              // Opcional - true = pagada/completada
  paymentMethod?: number | null; // Opcional - Puede ser null para split payments
  delivered?: boolean;           // Opcional - true = entregada
  tip?: number;                  // Opcional
  origin?: string;               // Opcional
  client?: string | null;        // Opcional
  paymentDiffer?: boolean;       // Opcional
  note?: string | null;          // Opcional
  tableId?: string | null;       // Opcional
}

// Filtros para Listar Órdenes
interface ListOrdersQuery {
  status?: boolean;              // true = pagadas, false = pendientes
  userId?: string;               // Filtrar por mesero
  tableId?: string;              // Filtrar por mesa
  paymentMethod?: number;        // 1, 2, o 3
  origin?: string;               // Filtrar por origen
  dateFrom?: string;             // Fecha inicio (ISO string)
  dateTo?: string;               // Fecha fin (ISO string)
}

// Respuesta de Item de Orden
interface OrderItemResponse {
  id: string;
  quantity: number;
  price: number;
  orderId: string;
  productId: string | null;
  menuItemId: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  product?: ProductResponse;      // Incluido si productId no es null
  menuItem?: MenuItemResponse;    // Incluido si menuItemId no es null
  extras?: OrderItemExtraResponse[];  // Extras del item
}

// Respuesta de Extra de Item de Orden
interface OrderItemExtraResponse {
  id: string;
  orderId: string;
  orderItemId: string;
  extraId: string;
  quantity: number;
  price: number;
  createdAt: string;
  updatedAt: string;
  extra?: MenuItemResponse;       // Información del extra
}

// Respuesta de Orden
interface OrderResponse {
  id: string;                    // UUID
  date: string;                  // Fecha de creación (ISO 8601)
  status: boolean;               // true = pagada/completada
  paymentMethod: number | null;  // 1: Cash, 2: Transfer, 3: Card, null: Split
  total: number;                 // Total con IVA y propina
  subtotal: number;              // Subtotal sin IVA
  iva: number;                   // IVA calculado
  delivered: boolean;            // true = entregada
  tableId: string | null;        // UUID de mesa (si aplica)
  tip: number;                   // Propina
  origin: string;                // Origen de la orden
  client: string | null;         // Nombre del cliente
  paymentDiffer: boolean;        // Pago diferido
  note: string | null;           // Nota de la orden
  userId: string;                // UUID del mesero
  createdAt: string;
  updatedAt: string;
  orderItems?: OrderItemResponse[];  // Items de la orden
  table?: TableResponse;             // Mesa (si aplica)
  payments?: PaymentResponse[];      // Pagos asociados
}
```

### Endpoints

| Operación | Método | Endpoint | Request | Response |
|-----------|--------|----------|---------|----------|
| Crear | `POST` | `/api/orders` | `CreateOrderRequest` | `OrderResponse` |
| Listar | `GET` | `/api/orders` | Query params | `OrderResponse[]` |
| Obtener | `GET` | `/api/orders/:order_id` | - | `OrderResponse` |
| Actualizar | `PUT` | `/api/orders/:order_id` | `UpdateOrderRequest` | `OrderResponse` |
| Eliminar | `DELETE` | `/api/orders/:order_id` | - | 204 No Content |

### Ejemplo Crear Orden

```typescript
// Request
POST /api/orders
{
  "paymentMethod": 1,
  "tableId": "550e8400-e29b-41d4-a716-446655440001",
  "tip": 15.00,
  "origin": "Local",
  "client": "Juan Pérez",
  "note": "Sin cebolla en la hamburguesa",
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "orderItems": [
    {
      "menuItemId": "550e8400-e29b-41d4-a716-446655440002",
      "quantity": 2,
      "price": 89.99,
      "note": "Término medio",
      "extras": [
        {
          "extraId": "550e8400-e29b-41d4-a716-446655440003",
          "quantity": 1,
          "price": 15.00
        }
      ]
    },
    {
      "productId": "550e8400-e29b-41d4-a716-446655440004",
      "quantity": 1,
      "price": 35.00
    }
  ]
}

// Response (201 Created)
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440005",
    "date": "2026-01-24T12:30:00.000Z",
    "status": false,
    "paymentMethod": 1,
    "total": 264.78,
    "subtotal": 229.98,
    "iva": 19.80,
    "delivered": false,
    "tableId": "550e8400-e29b-41d4-a716-446655440001",
    "tip": 15.00,
    "origin": "Local",
    "client": "Juan Pérez",
    "paymentDiffer": false,
    "note": "Sin cebolla en la hamburguesa",
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "orderItems": [...]
  },
  "timestamp": "2026-01-24T12:30:00.000Z"
}
```

**Nota sobre Items:**
- Cada item debe tener `productId` O `menuItemId`, pero NO ambos
- El `price` es el precio unitario
- El total del item se calcula: `price * quantity + sum(extras.price * extras.quantity)`

---

## Pagos

### Pagar orden (guía única)

Para pagar una orden (efectivo, transferencia o tarjeta física) usar **la guía única de pago:** [payment-frontend-guide.md](./payment-frontend-guide.md). Ahí están el endpoint, body, interfaces, validaciones, errores y ejemplo.

Resumen: `POST /api/orders/:order_id/pay` con `{ paymentMethod, amount, transferNumber? }`. El backend crea el pago, actualiza la orden y libera la mesa si aplica.

### Otros endpoints de pagos (listar, obtener, sesión)

| Operación | Método | Endpoint | Request | Response |
|-----------|--------|----------|---------|----------|
| Listar pagos | `GET` | `/api/payments` | Query params | `PaymentResponse[]` |
| Obtener pago | `GET` | `/api/payments/:payment_id` | - | `PaymentResponse` |
| Obtener sesión | `GET` | `/api/payments/:payment_id/session` | - | `PaymentSessionResponse` |

```typescript
// Filtros para Listar Pagos
interface ListPaymentsQuery {
  orderId?: string;
  userId?: string;
  status?: PaymentStatus;
  paymentMethod?: PaymentMethod;
  dateFrom?: string;
  dateTo?: string;
}

// Respuesta de Pago (listar/obtener)
interface PaymentResponse {
  id: string;
  orderId: string | null;
  userId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paymentMethod: PaymentMethod;
  gateway: PaymentGateway | null;
  gatewayTransactionId: string | null;
  metadata: any | null;
  createdAt: string;
  updatedAt: string;
}
```

---

## Reembolsos

### Interfaces

```typescript
// Crear Reembolso
interface CreateRefundRequest {
  paymentId: string;          // REQUERIDO - UUID del pago a reembolsar
  amount: number;             // REQUERIDO - Monto (positivo, máx 2 decimales)
  reason?: string | null;     // Opcional - Razón del reembolso (máx 500 chars)
}

// Filtros para Listar
interface ListRefundsQuery {
  paymentId?: string;
  status?: RefundStatus;
  dateFrom?: string;
  dateTo?: string;
}

// Procesar Reembolso Stripe
interface ProcessStripeRefundRequest {
  refundId: string;            // REQUERIDO - UUID del reembolso
  stripeRefundId: string;      // REQUERIDO - ID del refund en Stripe
  status: 'succeeded' | 'failed';
}

// Respuesta de Reembolso
interface RefundResponse {
  id: string;
  paymentId: string;
  amount: number;
  reason: string | null;
  gatewayRefundId: string | null;
  status: RefundStatus;
  createdAt: string;
}
```

### Endpoints

| Operación | Método | Endpoint | Request | Response |
|-----------|--------|----------|---------|----------|
| Crear | `POST` | `/api/refunds` | `CreateRefundRequest` | `RefundResponse` |
| Listar | `GET` | `/api/refunds` | Query params | `RefundResponse[]` |
| Obtener | `GET` | `/api/refunds/:refund_id` | - | `RefundResponse` |
| Crear Stripe | `POST` | `/api/refunds/stripe` | `CreateRefundRequest` | `RefundResponse` |
| Procesar Stripe | `POST` | `/api/refunds/stripe/process` | `ProcessStripeRefundRequest` | `RefundResponse` |

---

## Enums y Constantes

### Roles de Usuario

```typescript
type UserRole = 'ADMIN' | 'MANAGER' | 'WAITER' | 'CHEF';
```

### Métodos de Pago (para Order.paymentMethod)

```typescript
// Valor numérico usado en órdenes
const PaymentMethodNumber = {
  CASH: 1,        // Efectivo
  TRANSFER: 2,    // Transferencia
  CARD: 3         // Tarjeta (física o Stripe)
};
```

### Métodos de Pago (Enum string)

```typescript
type PaymentMethod = 
  | 'CASH'           // Efectivo
  | 'TRANSFER'       // Transferencia bancaria
  | 'CARD_PHYSICAL'  // Tarjeta física (terminal POS)
  | 'CARD_STRIPE';   // Tarjeta vía Stripe (online)
```

### Estados de Pago

```typescript
type PaymentStatus = 
  | 'PENDING'            // Pendiente
  | 'PROCESSING'         // Procesando
  | 'REQUIRES_ACTION'    // Requiere acción (3D Secure, etc.)
  | 'SUCCEEDED'          // Exitoso
  | 'FAILED'             // Fallido
  | 'CANCELED'           // Cancelado
  | 'REFUNDED'           // Reembolsado completamente
  | 'PARTIALLY_REFUNDED'; // Reembolsado parcialmente
```

### Estados de Reembolso

```typescript
type RefundStatus = 
  | 'PENDING'    // Pendiente
  | 'PROCESSING' // Procesando
  | 'SUCCEEDED'  // Exitoso
  | 'FAILED'     // Fallido
  | 'CANCELED';  // Cancelado
```

### Gateways de Pago

```typescript
type PaymentGateway = 'STRIPE' | 'PAYPAL' | 'CASH';
```

### Orígenes de Orden

```typescript
// Valores comunes (string libre, máx 50 chars)
const OrderOrigins = {
  LOCAL: 'Local',       // En el restaurante
  DELIVERY: 'Delivery', // A domicilio
  ORDER: 'Order',       // Pedido anticipado
  PICKUP: 'Pickup'      // Para llevar
};
```

---

## Formato de Respuestas

### Respuesta Exitosa

```typescript
interface SuccessResponse<T> {
  success: true;
  data: T;
  timestamp: string;  // ISO 8601
}
```

### Respuesta de Error

```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string;       // Código de error (ej: 'VALIDATION_ERROR')
    message: string;    // Mensaje descriptivo
    details?: any;      // Detalles adicionales (errores de validación, etc.)
  };
  timestamp: string;
}
```

### Códigos de Error Comunes

| Código | HTTP Status | Descripción |
|--------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Error de validación de datos |
| `UNAUTHORIZED` | 401 | No autenticado |
| `FORBIDDEN` | 403 | Sin permisos |
| `NOT_FOUND` | 404 | Recurso no encontrado |
| `CONFLICT` | 409 | Conflicto (ej: duplicado) |
| `INTERNAL_ERROR` | 500 | Error interno del servidor |

---

## Flujos de Trabajo Completos

### Flujo 1: Tomar Orden en Mesa

```typescript
// 1. Obtener mesas disponibles
GET /api/tables?availabilityStatus=true

// 2. Obtener items del menú activos
GET /api/menu-items?status=true

// 3. Crear la orden
POST /api/orders
{
  "tableId": "mesa-uuid",
  "origin": "Local",
  "client": "Mesa 5",
  "userId": "waiter-uuid",
  "orderItems": [
    {
      "menuItemId": "hamburguesa-uuid",
      "quantity": 2,
      "price": 89.99,
      "extras": [
        { "extraId": "queso-extra-uuid", "quantity": 1, "price": 15.00 }
      ]
    }
  ]
}

// 4. Actualizar disponibilidad de mesa
PUT /api/tables/:table_id
{ "availabilityStatus": false }
```

### Flujo 2: Procesar Pago

```typescript
// 1. Obtener orden pendiente
GET /api/orders/:order_id

// 2. Pagar orden: ver payment-frontend-guide.md (POST /api/orders/:order_id/pay)
//    Body: paymentMethod, amount, transferNumber?. Backend: pago + orden + libera mesa si aplica.

// 3. Marcar orden como entregada (opcional)
PUT /api/orders/:order_id
{ "delivered": true }
// No es necesario liberar mesa manualmente; el pago ya lo hace si aplica
```

### Flujo 3: Reembolso

```typescript
// 1. Obtener pago
GET /api/payments/:payment_id

// 2. Crear reembolso
POST /api/refunds
{
  "paymentId": "payment-uuid",
  "amount": 50.00,
  "reason": "Platillo no disponible"
}

// Para pagos con Stripe, usar:
POST /api/refunds/stripe
// Y luego procesar con:
POST /api/refunds/stripe/process
```

---

## WebSocket - Notificaciones en Tiempo Real

### Conexión

```typescript
// URL de WebSocket
const wsUrl = 'ws://localhost:3000/socket.io';

// Eventos disponibles
interface WebSocketEvents {
  // Notificaciones de pago
  'payment:created': PaymentResponse;
  'payment:updated': PaymentResponse;
  'payment:succeeded': PaymentResponse;
  'payment:failed': PaymentResponse;
  
  // Notificaciones de orden
  'order:created': OrderResponse;
  'order:updated': OrderResponse;
  'order:paid': OrderResponse;
}
```

### Uso con Pagos Stripe

```typescript
// Al crear pago Stripe, incluir connectionId
POST /api/payments/card-stripe
{
  "orderId": "order-uuid",
  "connectionId": "ws-connection-id"  // Obtener de la conexión WebSocket
}

// El servidor enviará notificaciones de estado via WebSocket
```

---

## Manejo de Errores

### Ejemplo de Manejo en Frontend

```typescript
async function createOrder(orderData: CreateOrderRequest): Promise<OrderResponse> {
  try {
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(orderData)
    });

    const result = await response.json();

    if (!result.success) {
      // Manejar error específico
      switch (result.error.code) {
        case 'VALIDATION_ERROR':
          // Mostrar errores de validación
          console.error('Errores de validación:', result.error.details);
          break;
        case 'NOT_FOUND':
          // Mesa o item no encontrado
          console.error('Recurso no encontrado:', result.error.message);
          break;
        case 'UNAUTHORIZED':
          // Redirigir a login
          window.location.href = '/login';
          break;
        default:
          console.error('Error:', result.error.message);
      }
      throw new Error(result.error.message);
    }

    return result.data;
  } catch (error) {
    console.error('Error de red:', error);
    throw error;
  }
}
```

### Validaciones Comunes que Fallan

| Campo | Validación | Mensaje de Error |
|-------|------------|------------------|
| `price` | Debe ser positivo | "Price must be positive" |
| `price` | Máx 2 decimales | "Price must have at most 2 decimal places" |
| `quantity` | Entero positivo | "Quantity must be positive" |
| `orderItems` | Mínimo 1 | "At least one order item must be provided" |
| `orderItems[].productId/menuItemId` | Uno requerido | "Either productId or menuItemId must be provided, but not both" |
| UUID | Formato válido | "Invalid X ID format" |
| `origin` | Requerido | "Origin is required" |

---

## Tipos TypeScript Completos

```typescript
// types/pos.ts

// ============ ENUMS ============
export type UserRole = 'ADMIN' | 'MANAGER' | 'WAITER' | 'CHEF';

export type PaymentMethod = 'CASH' | 'TRANSFER' | 'CARD_PHYSICAL' | 'CARD_STRIPE';

export type PaymentStatus = 
  | 'PENDING' | 'PROCESSING' | 'REQUIRES_ACTION' 
  | 'SUCCEEDED' | 'FAILED' | 'CANCELED' 
  | 'REFUNDED' | 'PARTIALLY_REFUNDED';

export type RefundStatus = 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'CANCELED';

export type PaymentGateway = 'STRIPE' | 'PAYPAL' | 'CASH';

// ============ AUTH ============
export interface LoginRequest {
  email: string;
  password: string;
}

export interface User {
  id: string;
  name: string;
  last_name: string;
  second_last_name: string | null;
  email: string;
  phone: string | null;
  status: boolean;
  rol: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

// ============ TABLE ============
export interface Table {
  id: string;
  numberTable: number;
  userId: string;
  status: boolean;
  availabilityStatus: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTableRequest {
  numberTable: number;
  status?: boolean;
  availabilityStatus?: boolean;
  userId: string;
}

export interface UpdateTableRequest {
  numberTable?: number;
  status?: boolean;
  availabilityStatus?: boolean;
}

// ============ MENU CATEGORY ============
export interface MenuCategory {
  id: string;
  name: string;
  status: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMenuCategoryRequest {
  name: string;
  status?: boolean;
}

export interface UpdateMenuCategoryRequest {
  name?: string;
  status?: boolean;
}

// ============ MENU ITEM ============
export interface MenuItem {
  id: string;
  name: string;
  price: number;
  status: boolean;
  isExtra: boolean;
  categoryId: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
  category?: MenuCategory;
}

export interface CreateMenuItemRequest {
  name: string;
  price: number;
  status?: boolean;
  categoryId?: string | null;
  userId: string;
}

export interface UpdateMenuItemRequest {
  name?: string;
  price?: number;
  status?: boolean;
  categoryId?: string;
  userId?: string;
}

// ============ PRODUCT ============
export interface Product {
  id: string;
  name: string;
  description: string | null;
  status: boolean;
  registrationDate: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductRequest {
  name: string;
  description?: string | null;
  status?: boolean;
  userId: string;
}

export interface UpdateProductRequest {
  name?: string;
  description?: string | null;
  status?: boolean;
}

// ============ ORDER ============
export interface OrderItemExtraInput {
  extraId: string;
  quantity?: number;
  price: number;
}

export interface OrderItemInput {
  productId?: string | null;
  menuItemId?: string | null;
  quantity: number;
  price: number;
  note?: string | null;
  extras?: OrderItemExtraInput[];
}

export interface CreateOrderRequest {
  paymentMethod?: number;
  tableId?: string | null;
  tip?: number;
  origin: string;
  client?: string | null;
  paymentDiffer?: boolean;
  note?: string | null;
  userId: string;
  orderItems: OrderItemInput[];
}

export interface UpdateOrderRequest {
  status?: boolean;
  paymentMethod?: number | null;
  delivered?: boolean;
  tip?: number;
  origin?: string;
  client?: string | null;
  paymentDiffer?: boolean;
  note?: string | null;
  tableId?: string | null;
}

export interface OrderItemExtra {
  id: string;
  orderId: string;
  orderItemId: string;
  extraId: string;
  quantity: number;
  price: number;
  createdAt: string;
  updatedAt: string;
  extra?: MenuItem;
}

export interface OrderItem {
  id: string;
  quantity: number;
  price: number;
  orderId: string;
  productId: string | null;
  menuItemId: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  product?: Product;
  menuItem?: MenuItem;
  extras?: OrderItemExtra[];
}

export interface Order {
  id: string;
  date: string;
  status: boolean;
  paymentMethod: number | null;
  total: number;
  subtotal: number;
  iva: number;
  delivered: boolean;
  tableId: string | null;
  tip: number;
  origin: string;
  client: string | null;
  paymentDiffer: boolean;
  note: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
  orderItems?: OrderItem[];
  table?: Table;
  payments?: Payment[];
}

// ============ PAYMENT ============
export interface Payment {
  id: string;
  orderId: string | null;
  userId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paymentMethod: PaymentMethod;
  gateway: PaymentGateway | null;
  gatewayTransactionId: string | null;
  metadata: any | null;
  createdAt: string;
  updatedAt: string;
}

export interface PayOrderWithCashRequest {
  orderId: string;
}

export interface PayOrderWithTransferRequest {
  orderId: string;
  transferNumber?: string;
}

export interface PayOrderWithCardPhysicalRequest {
  orderId: string;
}

export interface PayOrderWithCardStripeRequest {
  orderId: string;
  connectionId?: string | null;
}

export interface SplitPaymentPart {
  amount: number;
  paymentMethod: 'CASH' | 'TRANSFER' | 'CARD_PHYSICAL';
}

export interface PayOrderWithSplitPaymentRequest {
  orderId: string;
  firstPayment: SplitPaymentPart;
  secondPayment: SplitPaymentPart;
}

export interface ConfirmStripePaymentRequest {
  paymentIntentId: string;
  status: 'succeeded' | 'failed';
}

export interface StripePaymentResponse extends Payment {
  clientSecret: string;
}

export interface PaymentDifferentiation {
  id: string;
  orderId: string;
  firstPaymentAmount: number;
  firstPaymentMethod: PaymentMethod;
  secondPaymentAmount: number;
  secondPaymentMethod: PaymentMethod;
}

export interface SplitPaymentResponse {
  order: Order;
  payments: Payment[];
  paymentDifferentiation: PaymentDifferentiation;
}

// ============ REFUND ============
export interface Refund {
  id: string;
  paymentId: string;
  amount: number;
  reason: string | null;
  gatewayRefundId: string | null;
  status: RefundStatus;
  createdAt: string;
}

export interface CreateRefundRequest {
  paymentId: string;
  amount: number;
  reason?: string | null;
}

export interface ProcessStripeRefundRequest {
  refundId: string;
  stripeRefundId: string;
  status: 'succeeded' | 'failed';
}

// ============ API RESPONSE ============
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  timestamp: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
```

---

## Notas Adicionales

1. **Autenticación**: El token JWT se guarda automáticamente en una cookie HttpOnly al hacer login. El frontend puede también usar el header `Authorization: Bearer <token>`.

2. **IVA**: Se calcula automáticamente en el backend al crear la orden.

3. **Fechas**: Todas las fechas se manejan en formato ISO 8601 (UTC).

4. **UUIDs**: Todos los IDs son UUIDs v4.

5. **Decimales**: Los precios y montos aceptan máximo 2 decimales.

6. **Rate Limiting**: 
   - Login: 5 intentos por 15 minutos
   - Verificar usuario: 3 intentos por 15 minutos

7. **Soft Delete**: Las entidades no se eliminan físicamente, se marcan con `status: false`.
