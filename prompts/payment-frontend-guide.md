# Guía Frontend - Pagar Orden

Este documento es la **única guía** para que el frontend implemente el flujo de pago de una orden. **Un solo endpoint** (`POST /api/orders/:order_id/pay`) maneja **todo**: pago único (un método) y pago dividido (dos métodos). El backend crea el/los pago(s), actualiza la orden y, si aplica, libera la mesa en una sola transacción.

**Base URL:** `http://localhost:3000/api`

---

## Índice

1. [Endpoint y método](#endpoint-y-método)
2. [Request – Pago único](#request--pago-único)
3. [Request – Pago dividido](#request--pago-dividido)
4. [Response](#response)
5. [Interfaces TypeScript](#interfaces-typescript)
6. [Validaciones](#validaciones)
7. [Liberación de mesa](#liberación-de-mesa)
8. [Errores](#errores)
9. [Ejemplo de implementación](#ejemplo-de-implementación)

---

## Endpoint y método

| Operación | Método | Endpoint |
|-----------|--------|----------|
| **Pagar orden (único o dividido)** | `POST` | `/api/orders/:order_id/pay` |

- **`:order_id`** es el UUID de la orden a pagar (siempre en la URL; no hace falta enviar `orderId` en el body).
- **Autenticación:** `Authorization: Bearer <token>`.
- El **body** depende del tipo de pago: **pago único** (un método) o **pago dividido** (dos métodos). Ver secciones siguientes.

---

## Request – Pago único

Un solo método de pago (efectivo, transferencia o tarjeta física).

```http
POST /api/orders/:order_id/pay
Content-Type: application/json
Authorization: Bearer <token>
```

**Body (JSON):**

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `paymentMethod` | `'CASH' \| 'TRANSFER' \| 'CARD_PHYSICAL'` | Sí | Método de pago. |
| `amount` | `number` | Sí | Monto pagado. Debe coincidir con el total de la orden (tolerancia 0.01). Máx. 2 decimales. |
| `transferNumber` | `string` | No | Referencia de transferencia. Solo para `TRANSFER`. Máx. 100 caracteres. |

**Ejemplo:**

```json
{
  "paymentMethod": "CASH",
  "amount": 264.78
}
```

**Con transferencia:**

```json
{
  "paymentMethod": "TRANSFER",
  "amount": 264.78,
  "transferNumber": "REF-123"
}
```

---

## Request – Pago dividido

Dos métodos de pago distintos (ej. mitad efectivo, mitad tarjeta). **Mismo endpoint** que el pago único; solo cambia el body.

**Body (JSON):**

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `firstPayment` | `object` | Sí | Primer pago. |
| `firstPayment.amount` | `number` | Sí | Monto (positivo, máx. 2 decimales). |
| `firstPayment.paymentMethod` | `'CASH' \| 'TRANSFER' \| 'CARD_PHYSICAL'` | Sí | Método del primer pago. |
| `secondPayment` | `object` | Sí | Segundo pago. |
| `secondPayment.amount` | `number` | Sí | Monto (positivo, máx. 2 decimales). |
| `secondPayment.paymentMethod` | `'CASH' \| 'TRANSFER' \| 'CARD_PHYSICAL'` | Sí | Método del segundo pago (debe ser **distinto** al primero). |

**Restricciones:** `firstPayment.paymentMethod !== secondPayment.paymentMethod`; la suma de montos debe coincidir con el total de la orden (tolerancia 0.01).

**Ejemplo:**

```json
{
  "firstPayment": {
    "amount": 150.00,
    "paymentMethod": "CASH"
  },
  "secondPayment": {
    "amount": 114.78,
    "paymentMethod": "CARD_PHYSICAL"
  }
}
```

(Total orden = 264.78; `order_id` va en la URL.)

---

## Response

La respuesta depende del tipo de pago. Siempre incluye **`order`** y **`tableReleased`**. En **pago único** viene **`payment`**; en **pago dividido** vienen **`paymentDifferentiation`** y **`payments`**.

### 200 OK – Pago único

```json
{
  "success": true,
  "data": {
    "payment": {
      "id": "550e8400-e29b-41d4-a716-446655440010",
      "orderId": "550e8400-e29b-41d4-a716-446655440005",
      "amount": 264.78,
      "status": "SUCCEEDED",
      "paymentMethod": "CASH",
      "createdAt": "2026-01-31T12:35:00.000Z"
    },
    "order": {
      "id": "550e8400-e29b-41d4-a716-446655440005",
      "status": true,
      "paymentMethod": 1,
      "delivered": true
    },
    "tableReleased": true
  }
}
```

### 200 OK – Pago dividido

```json
{
  "success": true,
  "data": {
    "paymentDifferentiation": {
      "id": "uuid",
      "orderId": "550e8400-e29b-41d4-a716-446655440005",
      "firstPaymentAmount": 150.00,
      "firstPaymentMethod": "CASH",
      "secondPaymentAmount": 114.78,
      "secondPaymentMethod": "CARD_PHYSICAL"
    },
    "payments": [
      { "id": "uuid-1", "amount": 150.00, "status": "SUCCEEDED", "paymentMethod": "CASH" },
      { "id": "uuid-2", "amount": 114.78, "status": "SUCCEEDED", "paymentMethod": "CARD_PHYSICAL" }
    ],
    "order": {
      "id": "550e8400-e29b-41d4-a716-446655440005",
      "status": true,
      "paymentMethod": null,
      "delivered": true
    },
    "tableReleased": true
  }
}
```

- **Pago único:** `payment` = pago creado; `order.paymentMethod` = 1 (Cash), 2 (Transfer) o 3 (Card).
- **Pago dividido:** `paymentDifferentiation` + `payments` (dos registros); `order.paymentMethod` = `null`.
- **`order`:** Siempre `status: true`, **`delivered: true`** tras pagar (único o dividido).
- **`tableReleased`:** `true` si la orden era **Local** con mesa y el backend liberó la mesa en la misma transacción.

---

## Interfaces TypeScript

```typescript
// Request – Pago único
interface PayOrderRequestSingle {
  paymentMethod: 'CASH' | 'TRANSFER' | 'CARD_PHYSICAL';
  amount: number;           // Debe coincidir con order.total (tolerancia 0.01)
  transferNumber?: string;  // Opcional, solo para TRANSFER (máx 100 chars)
}

// Request – Pago dividido (mismo endpoint, otro body)
interface PayOrderRequestSplit {
  firstPayment: { amount: number; paymentMethod: 'CASH' | 'TRANSFER' | 'CARD_PHYSICAL' };
  secondPayment: { amount: number; paymentMethod: 'CASH' | 'TRANSFER' | 'CARD_PHYSICAL' };
}

// Respuesta – Pago único (incluye payment)
interface PayOrderResultSingle {
  payment: {
    id: string;
    orderId: string;
    amount: number;
    status: string;
    paymentMethod: string;
    createdAt: string;
  };
  order: PayOrderResultOrder;
  tableReleased: boolean;
}

// Respuesta – Pago dividido (incluye paymentDifferentiation y payments)
interface PayOrderResultSplit {
  paymentDifferentiation: {
    id: string;
    orderId: string;
    firstPaymentAmount: number;
    firstPaymentMethod: string;
    secondPaymentAmount: number;
    secondPaymentMethod: string;
  };
  payments: Array<{ id: string; amount: number; status: string; paymentMethod: string }>;
  order: PayOrderResultOrder;
  tableReleased: boolean;
}

interface PayOrderResultOrder {
  id: string;
  status: boolean;
  paymentMethod: number | null;  // 1: Cash, 2: Transfer, 3: Card; null en split
  delivered: boolean;
}
```

---

## Validaciones

- La orden debe existir (`:order_id` válido).
- La orden no debe estar ya pagada.
- **`amount`** debe coincidir con el total de la orden (tolerancia 0.01). Si no coincide, el backend responde con `PAYMENT_AMOUNT_MISMATCH`.
- **`paymentMethod`** debe ser exactamente `CASH`, `TRANSFER` o `CARD_PHYSICAL`.
- **`amount`** positivo, máximo 2 decimales.
- **`transferNumber`** opcional; si se envía, máximo 100 caracteres.

---

## Liberación de mesa

- Si la orden tiene **`origin: "Local"`** y **`tableId`** asignado, el backend marca la mesa como disponible (`availabilityStatus: true`) **en la misma transacción** que el pago.
- El frontend no debe llamar a ningún endpoint extra para liberar la mesa; basta con usar este endpoint de pago.
- En la respuesta, **`tableReleased: true`** indica que la mesa se liberó; úsalo para actualizar la UI (por ejemplo, quitar la mesa de “ocupada”).

---

## Errores

El API devuelve errores con estructura:

```json
{
  "success": false,
  "error": {
    "code": "CODIGO_ERROR",
    "message": "Descripción"
  }
}
```

| Código | HTTP | Descripción |
|--------|------|-------------|
| `ORDER_NOT_FOUND` | 404 | La orden no existe. |
| `ORDER_ALREADY_PAID` | 400 | La orden ya está pagada. |
| `PAYMENT_AMOUNT_MISMATCH` | 400 | El `amount` no coincide con el total de la orden. |
| Errores de validación (body) | 400 | Campos inválidos (por ejemplo `paymentMethod` no permitido, `amount` negativo). |

**Ejemplo de manejo en el frontend:**

```typescript
if (!res.ok) {
  const err = await res.json();
  switch (err.error?.code) {
    case 'ORDER_NOT_FOUND':
      showError('Orden no encontrada');
      break;
    case 'ORDER_ALREADY_PAID':
      showError('Esta orden ya fue pagada');
      break;
    case 'PAYMENT_AMOUNT_MISMATCH':
      showError('El monto debe coincidir con el total de la orden');
      break;
    default:
      showError(err.error?.message || 'Error al procesar el pago');
  }
  return;
}
```

---

## Ejemplo de implementación

```typescript
const payOrder = async (
  orderId: string,
  orderTotal: number,
  method: 'CASH' | 'TRANSFER' | 'CARD_PHYSICAL',
  transferNumber?: string
) => {
  const body: PayOrderRequest = {
    paymentMethod: method,
    amount: orderTotal,
  };
  if (method === 'TRANSFER' && transferNumber) {
    body.transferNumber = transferNumber;
  }

  const res = await fetch(`/api/orders/${orderId}/pay`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const json = await res.json();
  if (!res.ok) {
    // Manejar errores (ORDER_NOT_FOUND, ORDER_ALREADY_PAID, PAYMENT_AMOUNT_MISMATCH, etc.)
    throw new Error(json.error?.message ?? 'Error al pagar');
  }

  const data = json.data as PayOrderResultSingle;
  // data.payment, data.order, data.tableReleased
  if (data.tableReleased) {
    // Actualizar estado de mesas en la UI
  }
  return data;
};
```

---

**Resumen:** Para pagar una orden (único o dividido), el frontend solo debe usar **`POST /api/orders/:order_id/pay`**: body **pago único** = `{ paymentMethod, amount, transferNumber? }`; body **pago dividido** = `{ firstPayment: { amount, paymentMethod }, secondPayment: { amount, paymentMethod } }`. El backend se encarga del pago, actualización de la orden y liberación de mesa cuando aplica.
