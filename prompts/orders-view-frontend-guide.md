# Guía Frontend - Vista de Órdenes

Este documento describe las interfaces, endpoints, flujos y componentes que el frontend debe implementar para la vista de órdenes del sistema POS.

## Índice

1. [Resumen del Módulo](#resumen-del-módulo)
2. [Arquitectura de la Vista](#arquitectura-de-la-vista)
3. [Interfaces TypeScript](#interfaces-typescript)
4. [Endpoints de Órdenes](#endpoints-de-órdenes)
5. [Crear Orden](#crear-orden)
6. [Listar Órdenes](#listar-órdenes)
7. [Actualizar Orden](#actualizar-orden)
8. [Eliminar Orden](#eliminar-orden)
9. [Visibilidad de acciones en el detalle de orden](#visibilidad-de-acciones-en-el-detalle-de-orden)
10. [WebSocket - Notificaciones en Tiempo Real](#websocket---notificaciones-en-tiempo-real)
11. [Estados y Flujos de la Orden](#estados-y-flujos-de-la-orden)
12. [Componentes Sugeridos](#componentes-sugeridos)
13. [Ejemplos de Implementación](#ejemplos-de-implementación)
14. [Manejo de Errores](#manejo-de-errores)

---

## Resumen del Módulo

La vista de órdenes permite:
- Crear nuevas órdenes con items del menú y/o productos
- Agregar extras a los items
- Asignar órdenes a mesas
- Ver lista de órdenes pendientes y completadas
- Recibir notificaciones en tiempo real de nuevas órdenes
- Actualizar estado de órdenes (entregada, pagada)
- Filtrar órdenes por estado, fecha, mesero, mesa

**Base URL:** `http://localhost:3000/api`

---

## Arquitectura de la Vista

```
┌─────────────────────────────────────────────────────────────────┐
│                    VISTA DE ÓRDENES                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────────────────────────────────┐ │
│  │   FILTROS    │  │           LISTA DE ÓRDENES               │ │
│  │              │  │  ┌────────────────────────────────────┐  │ │
│  │ □ Pendientes │  │  │ Orden #1234     Mesa 5    $264.78 │  │ │
│  │ □ Pagadas    │  │  │ 2 items         Pendiente  14:30  │  │ │
│  │ □ Entregadas │  │  └────────────────────────────────────┘  │ │
│  │              │  │  ┌────────────────────────────────────┐  │ │
│  │ Fecha:       │  │  │ Orden #1235     Mesa 3    $150.00 │  │ │
│  │ [__________] │  │  │ 1 item          Pagada     14:25  │  │ │
│  │              │  │  └────────────────────────────────────┘  │ │
│  │ Mesa:        │  │                                          │ │
│  │ [Todas    ▼] │  │                                          │ │
│  │              │  │                                          │ │
│  │ Mesero:      │  │                                          │ │
│  │ [Todos    ▼] │  │                                          │ │
│  └──────────────┘  └──────────────────────────────────────────┘ │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                [+ NUEVA ORDEN]                            │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Interfaces TypeScript

### Entidades Base

```typescript
// ============ ORDEN ============

interface Order {
  id: string;                    // UUID
  date: string;                  // ISO 8601 - Fecha de creación
  status: boolean;               // true = pagada, false = pendiente
  paymentMethod: number | null;  // 1: Cash, 2: Transfer, 3: Card, null: Split
  total: number;                 // Total con IVA y propina
  subtotal: number;              // Subtotal sin IVA
  iva: number;                   // IVA calculado (16%)
  delivered: boolean;            // true = entregada al cliente
  tableId: string | null;        // UUID de mesa (opcional)
  tip: number;                   // Propina
  origin: string;                // 'Local', 'Delivery', 'Pickup', etc.
  client: string | null;         // Nombre del cliente
  paymentDiffer: boolean;        // Pago diferido
  note: string | null;           // Nota general de la orden
  userId: string;                // UUID del mesero
  createdAt: string;             // ISO 8601
  updatedAt: string;             // ISO 8601
  
  // Relaciones (cuando se incluyen)
  orderItems?: OrderItem[];
  table?: Table;   // GET /api/orders/:order_id incluye table cuando la orden tiene mesa (mostrar "Mesa N")
  user?: User;
  payments?: Payment[];
}

// ============ ITEM DE ORDEN ============

interface OrderItem {
  id: string;
  quantity: number;
  price: number;                 // Precio unitario
  orderId: string;
  productId: string | null;
  menuItemId: string | null;
  note: string | null;           // Nota del item específico
  createdAt: string;
  updatedAt: string;
  
  // Relaciones (cuando se incluyen)
  product?: Product;
  menuItem?: MenuItem;
  extras?: OrderItemExtra[];
}

// ============ EXTRA DE ITEM ============

interface OrderItemExtra {
  id: string;
  orderId: string;
  orderItemId: string;
  extraId: string;               // UUID del MenuItem con isExtra: true
  quantity: number;
  price: number;                 // Precio del extra al momento de la orden
  createdAt: string;
  updatedAt: string;
  
  // Relación
  extra?: MenuItem;
}

// ============ ENTIDADES RELACIONADAS ============

interface Table {
  id: string;
  numberTable: number;
  status: boolean;
  availabilityStatus: boolean;
}

interface MenuItem {
  id: string;
  name: string;
  price: number;
  status: boolean;
  isExtra: boolean;
  categoryId: string | null;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  status: boolean;
}

interface User {
  id: string;
  name: string;
  last_name: string;
  rol: 'ADMIN' | 'MANAGER' | 'WAITER' | 'CHEF';
}
```

### DTOs de Request

```typescript
// ============ CREAR ORDEN ============

interface OrderItemExtraInput {
  extraId: string;               // REQUERIDO - UUID del extra (MenuItem con isExtra: true)
  quantity?: number;             // Opcional (default: 1)
  price: number;                 // REQUERIDO - Precio del extra
}

interface OrderItemInput {
  productId?: string | null;     // UUID del producto (uno de los dos requerido)
  menuItemId?: string | null;    // UUID del item del menú (uno de los dos requerido)
  quantity: number;              // REQUERIDO - Entero positivo
  price: number;                 // REQUERIDO - Precio unitario (máx 2 decimales)
  note?: string | null;          // Opcional - Nota del item (máx 500 chars)
  extras?: OrderItemExtraInput[];// Opcional - Extras para este item
}

interface CreateOrderRequest {
  paymentMethod?: number;        // Opcional (default: 1) - 1: Cash, 2: Transfer, 3: Card
  tableId?: string | null;       // Opcional - UUID de la mesa
  tip?: number;                  // Opcional (default: 0)
  origin: string;                // REQUERIDO - 'Local', 'Delivery', 'Pickup', etc.
  client?: string | null;        // Opcional - Nombre del cliente (máx 200 chars)
  paymentDiffer?: boolean;       // Opcional (default: false)
  note?: string | null;          // Opcional - Nota de la orden (máx 1000 chars)
  userId: string;                // REQUERIDO - UUID del mesero
  orderItems: OrderItemInput[];  // REQUERIDO - Mínimo 1 item
}

// ============ ACTUALIZAR ORDEN ============

interface UpdateOrderItemInput {
  id?: string;                   // Opcional - Si se proporciona, se ignora (para compatibilidad)
  productId?: string | null;     // UUID del producto
  menuItemId?: string | null;    // UUID del item del menú
  quantity: number;              // REQUERIDO - Entero positivo
  price: number;                 // REQUERIDO - Precio unitario
  note?: string | null;          // Opcional - Nota del item
  extras?: OrderItemExtraInput[];// Opcional - Extras para este item
}

interface UpdateOrderRequest {
  status?: boolean;              // Marcar como pagada
  paymentMethod?: number | null; // Cambiar método de pago
  delivered?: boolean;           // Marcar como entregada
  tip?: number;                  // Actualizar propina
  origin?: string;               // Cambiar origen
  client?: string | null;        // Cambiar cliente
  paymentDiffer?: boolean;       // Cambiar pago diferido
  note?: string | null;          // Actualizar nota
  tableId?: string | null;       // Cambiar mesa
  orderItems?: UpdateOrderItemInput[]; // Opcional - Si se envía, REEMPLAZA todos los items
}

// ============ FILTROS PARA LISTAR ============

interface ListOrdersQuery {
  status?: boolean;              // true = pagadas, false = pendientes
  userId?: string;               // Filtrar por mesero
  tableId?: string;              // Filtrar por mesa
  paymentMethod?: number;        // 1, 2, 3
  origin?: string;               // Filtrar por origen
  dateFrom?: string;             // Fecha inicio (ISO string)
  dateTo?: string;               // Fecha fin (ISO string)
}
```

---

## Endpoints de Órdenes

| Operación | Método | Endpoint | Request Body | Query Params | Response |
|-----------|--------|----------|--------------|--------------|----------|
| **Crear** | `POST` | `/api/orders` | `CreateOrderRequest` | - | `Order` |
| **Listar** | `GET` | `/api/orders` | - | `ListOrdersQuery` | `Order[]` |
| **Obtener** | `GET` | `/api/orders/:order_id` | - | - | `Order` (incluye `table` si tiene mesa) |
| **Pagar** | `POST` | `/api/orders/:order_id/pay` | `PayOrderRequest` | - | `PayOrderResult` |
| **Actualizar** | `PUT` | `/api/orders/:order_id` | `UpdateOrderRequest` | - | `Order` |
| **Eliminar** | `DELETE` | `/api/orders/:order_id` | - | - | `204` |

---

## Pagar Orden

Para el flujo completo de pago (endpoint, body, interfaces, validaciones, errores y liberación de mesa), usar **la guía única de pago:** [payment-frontend-guide.md](./payment-frontend-guide.md).

Resumen: `POST /api/orders/:order_id/pay` con body `{ paymentMethod, amount, transferNumber? }`. El backend crea el pago, actualiza la orden y libera la mesa si la orden es Local con mesa asignada.

---

## Crear Orden

### Request

```typescript
POST /api/orders
Content-Type: application/json
Authorization: Bearer <token>

{
  "paymentMethod": 1,
  "tableId": "550e8400-e29b-41d4-a716-446655440001",
  "tip": 20.00,
  "origin": "Local",
  "client": "Juan Pérez",
  "note": "Cliente frecuente - darle postre de cortesía",
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "orderItems": [
    {
      "menuItemId": "550e8400-e29b-41d4-a716-446655440010",
      "quantity": 2,
      "price": 89.99,
      "note": "Término medio, sin cebolla",
      "extras": [
        {
          "extraId": "550e8400-e29b-41d4-a716-446655440020",
          "quantity": 1,
          "price": 15.00
        },
        {
          "extraId": "550e8400-e29b-41d4-a716-446655440021",
          "quantity": 2,
          "price": 10.00
        }
      ]
    },
    {
      "menuItemId": "550e8400-e29b-41d4-a716-446655440011",
      "quantity": 1,
      "price": 45.00
    },
    {
      "productId": "550e8400-e29b-41d4-a716-446655440030",
      "quantity": 3,
      "price": 25.00
    }
  ]
}
```

### Response (201 Created)

```typescript
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440100",
    "date": "2026-01-24T15:30:00.000Z",
    "status": false,
    "paymentMethod": 1,
    "total": 391.95,      // subtotal + iva + tip
    "subtotal": 319.98,   // (89.99*2 + 15 + 10*2 + 45 + 25*3)
    "iva": 51.97,         // subtotal * 0.16
    "delivered": false,
    "tableId": "550e8400-e29b-41d4-a716-446655440001",
    "tip": 20.00,
    "origin": "Local",
    "client": "Juan Pérez",
    "paymentDiffer": false,
    "note": "Cliente frecuente - darle postre de cortesía",
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "createdAt": "2026-01-24T15:30:00.000Z",
    "updatedAt": "2026-01-24T15:30:00.000Z",
    "orderItems": [
      {
        "id": "...",
        "quantity": 2,
        "price": 89.99,
        "menuItemId": "550e8400-e29b-41d4-a716-446655440010",
        "productId": null,
        "note": "Término medio, sin cebolla",
        "extras": [
          {
            "id": "...",
            "extraId": "550e8400-e29b-41d4-a716-446655440020",
            "quantity": 1,
            "price": 15.00
          },
          {
            "id": "...",
            "extraId": "550e8400-e29b-41d4-a716-446655440021",
            "quantity": 2,
            "price": 10.00
          }
        ]
      },
      // ... más items
    ]
  },
  "timestamp": "2026-01-24T15:30:00.000Z"
}
```

### Cálculo de Totales

```typescript
// El backend calcula automáticamente:

// 1. Subtotal de cada item
itemSubtotal = price * quantity;

// 2. Subtotal de extras
extrasSubtotal = extras.reduce((sum, extra) => sum + (extra.price * extra.quantity), 0);

// 3. Subtotal total
subtotal = items.reduce((sum, item) => {
  return sum + (item.price * item.quantity) + item.extrasSubtotal;
}, 0);

// 4. IVA (16%)
iva = subtotal * 0.16;

// 5. Total
total = subtotal + iva + tip;
```

### Validaciones Importantes

| Campo | Validación | Error |
|-------|------------|-------|
| `orderItems` | Mínimo 1 item | "At least one order item must be provided" |
| `orderItems[].productId/menuItemId` | Uno de los dos requerido, no ambos | "Either productId or menuItemId must be provided, but not both" |
| `price` | Positivo, máx 2 decimales | "Price must be positive" |
| `quantity` | Entero positivo | "Quantity must be positive" |
| `origin` | Requerido, máx 50 chars | "Origin is required" |
| `userId` | UUID válido | "Invalid user ID format" |
| `extras[].extraId` | Debe ser MenuItem con isExtra: true | "Invalid extra" |

---

## Listar Órdenes

### Request con Filtros

```typescript
// Órdenes pendientes de hoy
GET /api/orders?status=false&dateFrom=2026-01-24T00:00:00.000Z&dateTo=2026-01-24T23:59:59.999Z

// Órdenes de una mesa específica
GET /api/orders?tableId=550e8400-e29b-41d4-a716-446655440001

// Órdenes de un mesero
GET /api/orders?userId=550e8400-e29b-41d4-a716-446655440000

// Órdenes pagadas con tarjeta
GET /api/orders?status=true&paymentMethod=3

// Todas las órdenes
GET /api/orders
```

### Response (200 OK)

```typescript
{
  "success": true,
  "data": [
    {
      "id": "...",
      "date": "2026-01-24T15:30:00.000Z",
      "status": false,
      "paymentMethod": 1,
      "total": 391.95,
      "subtotal": 319.98,
      "iva": 51.97,
      "delivered": false,
      "tableId": "...",
      "tip": 20.00,
      "origin": "Local",
      "client": "Juan Pérez",
      // ... más campos
      "orderItems": [...],
      "table": {
        "id": "...",
        "numberTable": 5
      }
    },
    // ... más órdenes
  ],
  "timestamp": "2026-01-24T15:35:00.000Z"
}
```

---

## Actualizar Orden

### Marcar como Entregada

```typescript
PUT /api/orders/550e8400-e29b-41d4-a716-446655440100
{
  "delivered": true
}
```

### Cambiar Mesa

```typescript
PUT /api/orders/550e8400-e29b-41d4-a716-446655440100
{
  "tableId": "550e8400-e29b-41d4-a716-446655440002"
}
```

### Actualizar Propina

```typescript
PUT /api/orders/550e8400-e29b-41d4-a716-446655440100
{
  "tip": 50.00
}
```

### Marcar como Pagada (después de procesar pago)

```typescript
PUT /api/orders/550e8400-e29b-41d4-a716-446655440100
{
  "status": true
}
```

### Actualizar Items de la Orden

**IMPORTANTE:** Solo se pueden modificar items de órdenes **NO pagadas** (`status: false`).

Cuando se envía `orderItems`, se **reemplazan todos los items existentes** con los nuevos. El backend recalcula automáticamente `subtotal`, `iva` y `total`.

```typescript
PUT /api/orders/550e8400-e29b-41d4-a716-446655440100
{
  "orderItems": [
    {
      "menuItemId": "550e8400-e29b-41d4-a716-446655440010",
      "quantity": 3,  // Cambió de 2 a 3
      "price": 89.99,
      "note": "Término bien cocido",
      "extras": [
        {
          "extraId": "550e8400-e29b-41d4-a716-446655440020",
          "quantity": 2,
          "price": 15.00
        }
      ]
    },
    // Nuevo item agregado
    {
      "menuItemId": "550e8400-e29b-41d4-a716-446655440012",
      "quantity": 1,
      "price": 65.00
    }
  ]
}
```

### Response de Actualización con Items

```typescript
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440100",
    "status": false,
    "total": 428.95,      // Recalculado
    "subtotal": 369.97,   // Recalculado
    "iva": 59.20,         // Recalculado
    // ... resto de campos
    "orderItems": [
      // Nuevos items creados
    ]
  }
}
```

### Errores al Actualizar Items

| Error | Causa | Solución |
|-------|-------|----------|
| `ORDER_ALREADY_PAID` | La orden ya fue pagada | No se pueden modificar items |
| `PRODUCT_NOT_FOUND` | Producto no existe | Verificar ID del producto |
| `MENU_ITEM_NOT_FOUND` | Item del menú no existe | Verificar ID del item |
| `INVALID_MENU_ITEM` | Item es un extra | Mover a array de extras |
| `INVALID_EXTRA` | Extra no es un extra válido | Verificar que isExtra: true |

---

## Eliminar Orden

```typescript
DELETE /api/orders/550e8400-e29b-41d4-a716-446655440100

// Response: 204 No Content
```

**Nota:** Solo se pueden eliminar órdenes que no han sido pagadas (`status: false`).

---

## Visibilidad de acciones en el detalle de orden

En la vista de detalle de una orden, las acciones deben mostrarse según el estado:

| Acción   | Mostrar cuando                          | Ocultar cuando        |
|----------|-----------------------------------------|------------------------|
| **Editar** | Solo si la orden **no** está pagada (`status === false`) | Si la orden ya está pagada (`status === true`) |
| **Pagar**  | Solo si la orden no está pagada         | Si ya está pagada      |
| **Eliminar** | Solo si la orden no está pagada       | Si ya está pagada      |
| **Entregar** | Según lógica de negocio (ej. siempre o solo si no entregada) | - |

**Regla:** Si la orden ya está pagada (`order.status === true`), el botón **Editar** no debe aparecer. Tampoco deben mostrarse los botones **Pagar** ni **Eliminar**, ya que el backend rechazará esas operaciones.

```typescript
// Ejemplo: mostrar u ocultar botón Editar
const showEditButton = !order.status;  // false cuando orden pagada
```

---

## WebSocket - Notificaciones en Tiempo Real

### Conexión

```typescript
import { io } from 'socket.io-client';

const socket = io('ws://localhost:3000', {
  path: '/socket.io',
  transports: ['websocket'],
  auth: {
    token: 'jwt-token-here'
  }
});

socket.on('connect', () => {
  console.log('Conectado al WebSocket');
});
```

### Eventos de Órdenes

```typescript
// Tipos de notificación
type OrderNotificationType = 'created' | 'updated' | 'delivered' | 'canceled';

interface OrderNotification {
  orderId: string;
  notificationType: OrderNotificationType;
  orderData: {
    id: string;
    date: string;
    status: boolean;
    total: number;
    subtotal: number;
    delivered: boolean;
    tableId: string | null;
    origin: string;
    client: string | null;
  };
  timestamp: string;
}

// Escuchar notificaciones
socket.on('order:created', (notification: OrderNotification) => {
  console.log('Nueva orden:', notification);
  // Agregar orden a la lista
  // Mostrar toast/alerta
  // Reproducir sonido
});

socket.on('order:updated', (notification: OrderNotification) => {
  console.log('Orden actualizada:', notification);
  // Actualizar orden en la lista
});

socket.on('order:delivered', (notification: OrderNotification) => {
  console.log('Orden entregada:', notification);
  // Actualizar estado visual
});

socket.on('order:canceled', (notification: OrderNotification) => {
  console.log('Orden cancelada:', notification);
  // Remover o marcar orden
});
```

### Flujo de Notificaciones

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Mesero    │────▶│   Backend   │────▶│    SQS      │────▶│   Worker    │
│ Crea Orden  │     │ Guarda en   │     │   Queue     │     │  Procesa    │
└─────────────┘     │    MySQL    │     └─────────────┘     └──────┬──────┘
                    └─────────────┘                                 │
                                                                    ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Cocina    │◀────│  Frontend   │◀────│  WebSocket  │◀────│ Notify Use  │
│ Ve la orden │     │  Actualiza  │     │   Server    │     │    Case     │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

---

## Estados y Flujos de la Orden

### Estados de una Orden

```typescript
interface OrderStatus {
  status: boolean;     // Pago
  delivered: boolean;  // Entrega
}

// Combinaciones posibles:
// { status: false, delivered: false } = Pendiente (recién creada)
// { status: false, delivered: true }  = Entregada pero no pagada
// { status: true, delivered: false }  = Pagada pero no entregada (raro)
// { status: true, delivered: true }   = Completada
```

### Diagrama de Estados

```
                    ┌─────────────┐
                    │   NUEVA     │
                    │ status: ❌  │
                    │ delivered:❌│
                    └──────┬──────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │ ENTREGADA   │ │   PAGADA    │ │  CANCELADA  │
    │ status: ❌  │ │ status: ✅  │ │  (DELETE)   │
    │ delivered:✅│ │ delivered:❌│ └─────────────┘
    └──────┬──────┘ └──────┬──────┘
           │               │
           └───────┬───────┘
                   ▼
            ┌─────────────┐
            │ COMPLETADA  │
            │ status: ✅  │
            │ delivered:✅│
            └─────────────┘
```

### Colores Sugeridos por Estado

```typescript
const getOrderStatusColor = (order: Order): string => {
  if (!order.status && !order.delivered) return 'yellow';  // Pendiente
  if (!order.status && order.delivered) return 'orange';   // Entregada, sin pagar
  if (order.status && !order.delivered) return 'blue';     // Pagada, no entregada
  if (order.status && order.delivered) return 'green';     // Completada
  return 'gray';
};

const getOrderStatusLabel = (order: Order): string => {
  if (!order.status && !order.delivered) return 'Pendiente';
  if (!order.status && order.delivered) return 'Entregada';
  if (order.status && !order.delivered) return 'Pagada';
  if (order.status && order.delivered) return 'Completada';
  return 'Desconocido';
};
```

---

## Componentes Sugeridos

### 1. OrderCard (Tarjeta de Orden)

```typescript
interface OrderCardProps {
  order: Order;
  onViewDetails: (orderId: string) => void;
  onMarkDelivered: (orderId: string) => void;
  onProcessPayment: (orderId: string) => void;
}

// Información a mostrar:
// - Número de orden (últimos 8 chars del UUID)
// - Número de mesa o "Para llevar"
// - Nombre del cliente
// - Total
// - Hora de creación
// - Estado (badge con color)
// - Cantidad de items
// - Botones de acción
```

### 2. OrderList (Lista de Órdenes)

```typescript
interface OrderListProps {
  orders: Order[];
  loading: boolean;
  onRefresh: () => void;
  filters: ListOrdersQuery;
  onFilterChange: (filters: ListOrdersQuery) => void;
}

// Funcionalidades:
// - Filtros en sidebar o header
// - Ordenar por fecha, total, estado
// - Paginación o scroll infinito
// - Pull to refresh (mobile)
```

### 3. OrderDetail (Detalle de Orden)

```typescript
interface OrderDetailProps {
  orderId: string;
  onClose: () => void;
  onUpdate: (order: Order) => void;
}

// Secciones:
// - Header con info general: mostrar mesa con order.table?.numberTable (ej. "Mesa 5") o "Para llevar" si no hay table
//   (GET /api/orders/:order_id devuelve order.table cuando la orden tiene mesa asignada)
// - Lista de items con extras
// - Notas
// - Resumen de totales
// - Acciones (entregar, pagar, editar, eliminar). Ver "Visibilidad de acciones" más abajo.
// - Pagar: POST /api/orders/:order_id/pay con { paymentMethod, amount, transferNumber? }
```

### 4. CreateOrderForm (Formulario de Creación)

```typescript
interface CreateOrderFormProps {
  tables: Table[];
  menuItems: MenuItem[];
  products: Product[];
  currentUser: User;
  onSubmit: (order: CreateOrderRequest) => void;
  onCancel: () => void;
}

// Pasos sugeridos:
// 1. Seleccionar mesa (opcional)
// 2. Agregar items del menú/productos
// 3. Configurar extras para cada item
// 4. Agregar notas
// 5. Seleccionar origen
// 6. Confirmar
```

### 5. OrderItemSelector (Selector de Items)

```typescript
interface OrderItemSelectorProps {
  menuItems: MenuItem[];
  products: Product[];
  extras: MenuItem[];  // Items con isExtra: true
  selectedItems: OrderItemInput[];
  onItemsChange: (items: OrderItemInput[]) => void;
}

// Funcionalidades:
// - Búsqueda de items
// - Filtrar por categoría
// - Agregar cantidad
// - Agregar extras a cada item
// - Agregar nota por item
// - Ver subtotal en tiempo real
```

---

## Ejemplos de Implementación

### Hook para Gestión de Órdenes

```typescript
// hooks/useOrders.ts

import { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseOrdersOptions {
  autoRefresh?: boolean;
  filters?: ListOrdersQuery;
}

export function useOrders(options: UseOrdersOptions = {}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  // Fetch orders
  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      
      if (options.filters?.status !== undefined) {
        queryParams.append('status', String(options.filters.status));
      }
      if (options.filters?.tableId) {
        queryParams.append('tableId', options.filters.tableId);
      }
      if (options.filters?.userId) {
        queryParams.append('userId', options.filters.userId);
      }
      if (options.filters?.dateFrom) {
        queryParams.append('dateFrom', options.filters.dateFrom);
      }
      if (options.filters?.dateTo) {
        queryParams.append('dateTo', options.filters.dateTo);
      }

      const response = await fetch(`/api/orders?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });

      const result = await response.json();

      if (result.success) {
        setOrders(result.data);
        setError(null);
      } else {
        setError(result.error.message);
      }
    } catch (err) {
      setError('Error al cargar órdenes');
    } finally {
      setLoading(false);
    }
  }, [options.filters]);

  // Create order
  const createOrder = async (orderData: CreateOrderRequest): Promise<Order> => {
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify(orderData)
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error.message);
    }

    // La orden se agregará via WebSocket, pero podemos agregarla inmediatamente
    setOrders(prev => [result.data, ...prev]);
    return result.data;
  };

  // Update order
  const updateOrder = async (orderId: string, data: UpdateOrderRequest): Promise<Order> => {
    const response = await fetch(`/api/orders/${orderId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error.message);
    }

    setOrders(prev => prev.map(o => o.id === orderId ? result.data : o));
    return result.data;
  };

  // Delete order
  const deleteOrder = async (orderId: string): Promise<void> => {
    const response = await fetch(`/api/orders/${orderId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${getToken()}`
      }
    });

    if (!response.ok) {
      const result = await response.json();
      throw new Error(result.error?.message || 'Error al eliminar');
    }

    setOrders(prev => prev.filter(o => o.id !== orderId));
  };

  // WebSocket setup
  useEffect(() => {
    const newSocket = io('ws://localhost:3000', {
      path: '/socket.io',
      transports: ['websocket'],
      auth: { token: getToken() }
    });

    newSocket.on('order:created', (notification) => {
      setOrders(prev => [notification.orderData, ...prev]);
      // Mostrar notificación toast
      showToast('Nueva orden recibida', 'info');
    });

    newSocket.on('order:updated', (notification) => {
      setOrders(prev => prev.map(o => 
        o.id === notification.orderId 
          ? { ...o, ...notification.orderData }
          : o
      ));
    });

    newSocket.on('order:delivered', (notification) => {
      setOrders(prev => prev.map(o => 
        o.id === notification.orderId 
          ? { ...o, delivered: true }
          : o
      ));
    });

    newSocket.on('order:canceled', (notification) => {
      setOrders(prev => prev.filter(o => o.id !== notification.orderId));
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return {
    orders,
    loading,
    error,
    refetch: fetchOrders,
    createOrder,
    updateOrder,
    deleteOrder,
    socket
  };
}
```

### Componente de Lista de Órdenes

```typescript
// components/OrderList.tsx

import React from 'react';
import { useOrders } from '../hooks/useOrders';

export function OrderList() {
  const { orders, loading, error, refetch, updateOrder } = useOrders({
    filters: { status: false } // Solo pendientes
  });

  const handleMarkDelivered = async (orderId: string) => {
    try {
      await updateOrder(orderId, { delivered: true });
      showToast('Orden marcada como entregada', 'success');
    } catch (err) {
      showToast('Error al actualizar orden', 'error');
    }
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorMessage message={error} onRetry={refetch} />;

  return (
    <div className="order-list">
      <header className="order-list__header">
        <h2>Órdenes Pendientes ({orders.length})</h2>
        <button onClick={refetch}>Actualizar</button>
      </header>

      <div className="order-list__grid">
        {orders.map(order => (
          <OrderCard
            key={order.id}
            order={order}
            onMarkDelivered={() => handleMarkDelivered(order.id)}
          />
        ))}
      </div>

      {orders.length === 0 && (
        <EmptyState message="No hay órdenes pendientes" />
      )}
    </div>
  );
}
```

### Formulario de Crear Orden

```typescript
// components/CreateOrderForm.tsx

import React, { useState } from 'react';

interface Props {
  onSubmit: (order: CreateOrderRequest) => Promise<void>;
  onCancel: () => void;
}

export function CreateOrderForm({ onSubmit, onCancel }: Props) {
  const [items, setItems] = useState<OrderItemInput[]>([]);
  const [tableId, setTableId] = useState<string | null>(null);
  const [origin, setOrigin] = useState('Local');
  const [client, setClient] = useState('');
  const [note, setNote] = useState('');
  const [tip, setTip] = useState(0);
  const [loading, setLoading] = useState(false);

  const { user } = useAuth(); // Hook de autenticación
  const { data: tables } = useTables();
  const { data: menuItems } = useMenuItems({ status: true });

  // Calcular totales en tiempo real
  const subtotal = items.reduce((sum, item) => {
    const itemTotal = item.price * item.quantity;
    const extrasTotal = (item.extras || []).reduce(
      (eSum, extra) => eSum + extra.price * (extra.quantity || 1),
      0
    );
    return sum + itemTotal + extrasTotal;
  }, 0);

  const iva = subtotal * 0.16;
  const total = subtotal + iva + tip;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (items.length === 0) {
      showToast('Agrega al menos un item', 'warning');
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        orderItems: items,
        tableId,
        origin,
        client: client || null,
        note: note || null,
        tip,
        userId: user.id,
      });
      showToast('Orden creada exitosamente', 'success');
    } catch (err) {
      showToast('Error al crear orden', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="create-order-form">
      {/* Selector de Mesa */}
      <section>
        <label>Mesa (opcional)</label>
        <select 
          value={tableId || ''} 
          onChange={e => setTableId(e.target.value || null)}
        >
          <option value="">Sin mesa (Para llevar)</option>
          {tables?.filter(t => t.availabilityStatus).map(table => (
            <option key={table.id} value={table.id}>
              Mesa {table.numberTable}
            </option>
          ))}
        </select>
      </section>

      {/* Selector de Items */}
      <section>
        <label>Items del Menú</label>
        <ItemSelector
          menuItems={menuItems}
          selectedItems={items}
          onItemsChange={setItems}
        />
      </section>

      {/* Origen */}
      <section>
        <label>Origen *</label>
        <select value={origin} onChange={e => setOrigin(e.target.value)}>
          <option value="Local">Local</option>
          <option value="Delivery">Delivery</option>
          <option value="Pickup">Para llevar</option>
        </select>
      </section>

      {/* Cliente */}
      <section>
        <label>Nombre del Cliente</label>
        <input
          type="text"
          value={client}
          onChange={e => setClient(e.target.value)}
          placeholder="Ej: Juan Pérez"
          maxLength={200}
        />
      </section>

      {/* Propina */}
      <section>
        <label>Propina</label>
        <input
          type="number"
          value={tip}
          onChange={e => setTip(Number(e.target.value))}
          min={0}
          step={0.01}
        />
      </section>

      {/* Nota */}
      <section>
        <label>Nota</label>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Instrucciones especiales..."
          maxLength={1000}
        />
      </section>

      {/* Resumen */}
      <section className="order-summary">
        <div>Subtotal: ${subtotal.toFixed(2)}</div>
        <div>IVA (16%): ${iva.toFixed(2)}</div>
        <div>Propina: ${tip.toFixed(2)}</div>
        <div className="total">Total: ${total.toFixed(2)}</div>
      </section>

      {/* Acciones */}
      <div className="form-actions">
        <button type="button" onClick={onCancel} disabled={loading}>
          Cancelar
        </button>
        <button type="submit" disabled={loading || items.length === 0}>
          {loading ? 'Creando...' : 'Crear Orden'}
        </button>
      </div>
    </form>
  );
}
```

---

## Manejo de Errores

### Códigos de Error Específicos de Órdenes

| Código | HTTP | Descripción | Acción Sugerida |
|--------|------|-------------|-----------------|
| `USER_NOT_FOUND` | 404 | Usuario no existe | Verificar sesión |
| `TABLE_NOT_FOUND` | 404 | Mesa no existe | Recargar mesas |
| `PRODUCT_NOT_FOUND` | 404 | Producto no existe | Quitar item |
| `MENU_ITEM_NOT_FOUND` | 404 | Item del menú no existe | Quitar item |
| `INVALID_MENU_ITEM` | 400 | Item es un extra, no un platillo | Mover a extras |
| `ORDER_NOT_FOUND` | 404 | Orden no existe | Recargar lista |
| `VALIDATION_ERROR` | 400 | Datos inválidos | Mostrar errores |

### Ejemplo de Manejo

```typescript
async function handleCreateOrder(orderData: CreateOrderRequest) {
  try {
    const order = await createOrder(orderData);
    return order;
  } catch (error) {
    if (error.message.includes('USER_NOT_FOUND')) {
      // Sesión expirada
      logout();
      navigate('/login');
    } else if (error.message.includes('TABLE_NOT_FOUND')) {
      showToast('La mesa seleccionada ya no está disponible', 'warning');
      refetchTables();
    } else if (error.message.includes('MENU_ITEM_NOT_FOUND')) {
      showToast('Uno de los items ya no está disponible', 'warning');
      refetchMenuItems();
    } else if (error.message.includes('VALIDATION_ERROR')) {
      // Mostrar errores de validación específicos
      showValidationErrors(error.details);
    } else {
      showToast('Error al crear la orden', 'error');
    }
    throw error;
  }
}
```

---

## Checklist de Implementación

### Vista Principal
- [ ] Lista de órdenes con scroll/paginación
- [ ] Filtros (estado, fecha, mesa, mesero)
- [ ] Búsqueda por cliente o número de orden
- [ ] Ordenamiento (fecha, total)
- [ ] Pull to refresh
- [ ] Estado vacío

### Tarjeta de Orden
- [ ] Info básica (número, mesa, cliente, total, hora)
- [ ] Badge de estado con color
- [ ] Cantidad de items
- [ ] Botón ver detalles
- [ ] Botones de acción rápida

### Detalle de Orden
- [ ] Header con info completa
- [ ] Lista de items con extras
- [ ] Notas (general y por item)
- [ ] Resumen de totales
- [ ] Historial de cambios (opcional)
- [ ] Botones: Entregar, Pagar, Editar, Eliminar (Editar/Pagar/Eliminar solo si `order.status === false`; ver sección "Visibilidad de acciones")

### Crear Orden
- [ ] Selector de mesa
- [ ] Buscador de items
- [ ] Agregar/quitar items
- [ ] Configurar extras
- [ ] Notas por item
- [ ] Nota general
- [ ] Selector de origen
- [ ] Input de propina
- [ ] Cálculo de totales en tiempo real
- [ ] Validación de formulario
- [ ] Confirmación antes de crear

### WebSocket
- [ ] Conexión al iniciar app
- [ ] Reconexión automática
- [ ] Escuchar eventos de órdenes
- [ ] Actualizar lista en tiempo real
- [ ] Mostrar notificaciones/toasts
- [ ] Sonido para nuevas órdenes (opcional)

### UX/UI
- [ ] Loading states
- [ ] Error states
- [ ] Skeleton loaders
- [ ] Animaciones de transición
- [ ] Responsive design
- [ ] Accesibilidad (a11y)
