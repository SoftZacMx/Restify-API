# Guía Frontend - Pago Dividido (Split Payment)

Este documento explica cómo implementar en el frontend el **pago dividido** de una orden: pagar con **dos métodos distintos** (ej. mitad efectivo, mitad tarjeta). Se usa **el mismo endpoint** que el pago único: **`POST /api/orders/:order_id/pay`**; solo cambia el body (ver [payment-frontend-guide.md](./payment-frontend-guide.md) para pago único).

**Base URL:** `http://localhost:3000/api`

---

## Índice

1. [Qué es el pago dividido](#qué-es-el-pago-dividido)
2. [Cuándo usar pago único vs pago dividido](#cuándo-usar-pago-único-vs-pago-dividido)
3. [Endpoint y método](#endpoint-y-método)
4. [Request](#request)
5. [Response](#response)
6. [Interfaces TypeScript](#interfaces-typescript)
7. [Validaciones](#validaciones)
8. [Liberación de mesa](#liberación-de-mesa)
9. [Errores](#errores)
10. [Flujo en la UI](#flujo-en-la-ui)
11. [Ejemplo de implementación](#ejemplo-de-implementación)

---

## Qué es el pago dividido

- El cliente paga **una sola orden** con **dos métodos de pago distintos** (ej. $50 efectivo + $30 tarjeta).
- Los métodos permitidos son: **CASH**, **TRANSFER**, **CARD_PHYSICAL** (los mismos que en pago único).
- Los **dos métodos deben ser diferentes** (no se puede “dividir” en dos pagos del mismo tipo).
- La **suma de los dos montos debe coincidir exactamente con el total de la orden** (tolerancia 0.01).
- Tras un pago dividido exitoso, la orden queda **pagada** (`status: true`), con **`paymentDiffer: true`** y **`paymentMethod: null`** (porque son dos métodos). Si la orden es **Local** y tiene mesa, la **mesa se libera** en la misma operación.

---

## Cuándo usar pago único vs pago dividido

| Caso | Endpoint | Body |
|------|----------|------|
| Un solo método (efectivo, transferencia o tarjeta) | `POST /api/orders/:order_id/pay` | `{ paymentMethod, amount, transferNumber? }` |
| Dos métodos distintos (ej. mitad efectivo, mitad tarjeta) | `POST /api/orders/:order_id/pay` | `{ firstPayment: { amount, paymentMethod }, secondPayment: { amount, paymentMethod } }` |

**Un solo endpoint** para ambos; el tipo de pago se determina por la forma del body.

---

## Endpoint y método

| Operación | Método | Endpoint |
|-----------|--------|----------|
| **Pagar orden con pago dividido** | `POST` | `/api/orders/:order_id/pay` |

- **`:order_id`** es el UUID de la orden (en la URL; **no** enviar `orderId` en el body).
- **Autenticación:** `Authorization: Bearer <token>`.

---

## Request

```http
POST /api/orders/:order_id/pay
Content-Type: application/json
Authorization: Bearer <token>
```

**Body (JSON):** Solo `firstPayment` y `secondPayment`. El ID de la orden va en la URL.

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `firstPayment` | `object` | **Sí** | Primer pago. |
| `firstPayment.amount` | `number` | **Sí** | Monto (positivo, máx. 2 decimales). |
| `firstPayment.paymentMethod` | `'CASH' \| 'TRANSFER' \| 'CARD_PHYSICAL'` | **Sí** | Método del primer pago. |
| `secondPayment` | `object` | **Sí** | Segundo pago. |
| `secondPayment.amount` | `number` | **Sí** | Monto (positivo, máx. 2 decimales). |
| `secondPayment.paymentMethod` | `'CASH' \| 'TRANSFER' \| 'CARD_PHYSICAL'` | **Sí** | Método del segundo pago (debe ser **distinto** al primero). |

**Restricciones:**

- `firstPayment.paymentMethod !== secondPayment.paymentMethod`
- `firstPayment.amount + secondPayment.amount === order.total` (tolerancia 0.01)
- La orden no debe estar ya pagada ni tener ya un pago dividido registrado.

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

(Total orden = 264.78; `order_id` en la URL: `POST /api/orders/550e8400-e29b-41d4-a716-446655440005/pay`)

---

## Response

### 200 OK

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
      {
        "id": "uuid-1",
        "amount": 150.00,
        "status": "SUCCEEDED",
        "paymentMethod": "CASH"
      },
      {
        "id": "uuid-2",
        "amount": 114.78,
        "status": "SUCCEEDED",
        "paymentMethod": "CARD_PHYSICAL"
      }
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

- **`paymentDifferentiation`:** Registro del pago dividido (montos y métodos).
- **`payments`:** Los dos pagos creados (ambos `SUCCEEDED`).
- **`order`:** Orden actualizada: `status: true`, `paymentMethod: null`, **`delivered: true`**.
- **`tableReleased`:** `true` si la orden era **Local** con mesa y el backend liberó la mesa.

---

## Interfaces TypeScript

```typescript
// Request – order_id va en la URL, no en el body
interface SplitPaymentRequest {
  firstPayment: {
    amount: number;           // Positivo, máx. 2 decimales
    paymentMethod: 'CASH' | 'TRANSFER' | 'CARD_PHYSICAL';
  };
  secondPayment: {
    amount: number;
    paymentMethod: 'CASH' | 'TRANSFER' | 'CARD_PHYSICAL';  // Distinto a firstPayment
  };
}

// Response
interface SplitPaymentResult {
  paymentDifferentiation: {
    id: string;
    orderId: string;
    firstPaymentAmount: number;
    firstPaymentMethod: string;
    secondPaymentAmount: number;
    secondPaymentMethod: string;
  };
  payments: Array<{
    id: string;
    amount: number;
    status: string;
    paymentMethod: string;
  }>;
  order: {
    id: string;
    status: boolean;
    paymentMethod: number | null;
    delivered: boolean;
  };
  tableReleased: boolean;
}
```

---

## Validaciones

- La orden debe existir y no estar ya pagada.
- La orden no debe tener ya un pago dividido (`paymentDiffer` debe ser `false` antes de llamar).
- Los dos métodos deben ser **CASH**, **TRANSFER** o **CARD_PHYSICAL** y **distintos entre sí**.
- Los dos montos deben ser positivos y con máximo 2 decimales.
- **firstPayment.amount + secondPayment.amount** debe ser igual al **total de la orden** (tolerancia 0.01). No puede ser mayor ni menor (salvo redondeo 0.01).

En el frontend conviene:

- Obtener el total de la orden (ej. `GET /api/orders/:order_id`) antes de abrir el modal de pago dividido.
- Validar localmente que la suma coincida con `order.total` y que los dos métodos sean distintos.
- Mostrar un mensaje claro si la suma no cuadra (ej. “La suma debe ser igual al total: $X.XX”).

---

## Liberación de mesa

- Si la orden tiene **`origin: "Local"`** y **`tableId`** asignado, el backend marca la mesa como disponible (**`availabilityStatus: true`**) en la misma operación que el pago dividido.
- No hace falta llamar a otro endpoint para liberar la mesa.
- En la respuesta, **`tableReleased: true`** indica que la mesa se liberó; úsalo para actualizar la UI (p. ej. quitar la mesa de “ocupada”).

---

## Errores

El API devuelve errores con estructura estándar; los códigos relevantes para pago dividido son:

| Código | HTTP | Descripción |
|--------|------|-------------|
| `ORDER_NOT_FOUND` | 404 | La orden no existe. |
| `ORDER_ALREADY_PAID` | 400 | La orden ya está pagada. |
| `SPLIT_PAYMENT_ALREADY_EXISTS` | 400 | La orden ya tiene un pago dividido registrado. |
| `SPLIT_PAYMENT_SAME_METHOD` | 400 | Los dos métodos son iguales; deben ser distintos. |
| `SPLIT_PAYMENT_INVALID_METHOD` | 400 | Algún método no es CASH, TRANSFER o CARD_PHYSICAL. |
| `SPLIT_PAYMENT_AMOUNT_EXCEEDS_TOTAL` | 400 | La suma de los dos montos supera el total de la orden. |
| `SPLIT_PAYMENT_AMOUNT_MISMATCH` | 400 | La suma no coincide con el total de la orden (tolerancia 0.01). |

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
    case 'SPLIT_PAYMENT_ALREADY_EXISTS':
      showError('Esta orden ya tiene un pago dividido');
      break;
    case 'SPLIT_PAYMENT_SAME_METHOD':
      showError('Debes elegir dos métodos de pago distintos');
      break;
    case 'SPLIT_PAYMENT_AMOUNT_MISMATCH':
    case 'SPLIT_PAYMENT_AMOUNT_EXCEEDS_TOTAL':
      showError('La suma de los dos pagos debe ser igual al total de la orden');
      break;
    default:
      showError(err.error?.message || 'Error al procesar el pago dividido');
  }
  return;
}
```

---

## Flujo en la UI

1. El usuario abre el detalle de una orden **no pagada** y elige **“Pagar con dos métodos”** (o “Pago dividido”).
2. El frontend muestra un formulario con:
   - Total de la orden (solo lectura, obtenido de `order.total`).
   - Primer pago: monto + método (CASH, TRANSFER, CARD_PHYSICAL).
   - Segundo pago: monto + método (debe ser distinto al primero).
3. Validar en cliente:
   - Suma = total de la orden (tolerancia 0.01).
   - Métodos distintos.
   - Montos positivos, máx. 2 decimales.
4. Enviar **POST /api/orders/:order_id/pay** con body `{ firstPayment, secondPayment }` (order_id en la URL).
5. Si la respuesta es 200:
   - Mostrar confirmación (y opcionalmente `tableReleased` si aplica).
   - Cerrar modal y actualizar lista de órdenes / estado de mesas.
6. Si la respuesta es 4xx, mostrar el mensaje según el código de error anterior.

---

## Ejemplo de implementación

```typescript
const payOrderSplit = async (
  orderId: string,
  orderTotal: number,
  first: { amount: number; paymentMethod: 'CASH' | 'TRANSFER' | 'CARD_PHYSICAL' },
  second: { amount: number; paymentMethod: 'CASH' | 'TRANSFER' | 'CARD_PHYSICAL' }
) => {
  const body: SplitPaymentRequest = {
    firstPayment: first,
    secondPayment: second,
  };

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
    // Manejar errores (ORDER_NOT_FOUND, SPLIT_PAYMENT_*, etc.)
    throw new Error(json.error?.message ?? 'Error en pago dividido');
  }

  const data = json.data as SplitPaymentResult;
  if (data.tableReleased) {
    // Actualizar estado de mesas en la UI
  }
  return data;
};
```

**Validación antes de enviar:**

```typescript
const total = first.amount + second.amount;
if (Math.abs(total - orderTotal) > 0.01) {
  showError(`La suma ($${total.toFixed(2)}) debe ser igual al total ($${orderTotal.toFixed(2)})`);
  return;
}
if (first.paymentMethod === second.paymentMethod) {
  showError('Elige dos métodos de pago distintos');
  return;
}
```

---

## Resumen

- **Pago dividido** = una orden pagada con **dos métodos distintos** (CASH, TRANSFER, CARD_PHYSICAL).
- **Endpoint:** **`POST /api/orders/:order_id/pay`** (mismo que pago único) con body `{ firstPayment: { amount, paymentMethod }, secondPayment: { amount, paymentMethod } }`. El `order_id` va en la URL.
- **Reglas:** métodos distintos; suma de montos = total de la orden (tolerancia 0.01).
- **Mesa:** si la orden es Local con mesa, se libera automáticamente; usar `tableReleased` en la respuesta para la UI.
- Para **pago con un solo método**, usar el mismo endpoint con body `{ paymentMethod, amount, transferNumber? }` según [payment-frontend-guide.md](./payment-frontend-guide.md).
