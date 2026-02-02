# Guía Frontend - Módulo de Gastos (Expenses)

Guía de implementación para el frontend del **módulo de gastos**: CRUD de gastos, tipos de gasto (servicios, utilidades, renta, mercancía, otros) y ítems de mercancía cuando el tipo es MERCHANDISE.

**Base URL:** `http://localhost:3000/api`

---

## Índice

1. [Contexto: tipos de gasto](#contexto-tipos-de-gasto)
2. [Unidades de medida](#unidades-de-medida)
3. [Endpoints y métodos HTTP](#endpoints-y-métodos-http)
4. [Crear gasto](#crear-gasto)
5. [Obtener gasto](#obtener-gasto)
6. [Listar gastos](#listar-gastos)
7. [Actualizar gasto](#actualizar-gasto)
8. [Eliminar gasto](#eliminar-gasto)
9. [Interfaces TypeScript](#interfaces-typescript)
10. [Validaciones y errores](#validaciones-y-errores)
11. [Ejemplos de implementación](#ejemplos-de-implementación)

---

## Contexto: tipos de gasto

El backend soporta un **módulo unificado de gastos** con los siguientes tipos (`ExpenseType`):

| Tipo (enum)       | Descripción                                      | ¿Lleva ítems? |
|-------------------|--------------------------------------------------|----------------|
| `SERVICE_BUSINESS`| Servicios del negocio (limpieza, seguridad, etc.) | No             |
| `UTILITY`         | Servicios públicos (luz, agua, internet)         | No             |
| `RENT`            | Renta                                            | No             |
| `MERCHANDISE`     | Compra de mercancía (productos/inventario)       | **Sí**         |
| `OTHER`           | Otros gastos                                     | No             |

- **Título**: Es **obligatorio** en la creación de todo gasto. Máximo 200 caracteres.
- **Gastos sin ítems** (SERVICE_BUSINESS, UTILITY, RENT, OTHER): se envían `title`, `type`, `total`, `subtotal`, `iva`, `paymentMethod`, `userId` y opcionalmente `date`, `description`. No se envía `items`.
- **Gastos tipo MERCHANDISE**: son obligatorios los `items` (array de productos con `productId`, `amount`, `subtotal`, `total`, y opcionalmente `unitOfMeasure`). El backend valida que la suma de ítems coincida con `subtotal`, `iva` y `total` del gasto (tolerancia 0.01).

**Método de pago** (`paymentMethod`): `1` = Efectivo, `2` = Transferencia, `3` = Tarjeta.

---

## Unidades de medida

Para ítems de gastos tipo **MERCHANDISE**, el campo `unitOfMeasure` solo acepta los valores del enum **UnitOfMeasure**:

| Valor (API) | Descripción |
|-------------|-------------|
| `KG`        | Kilogramos  |
| `G`         | Gramos      |
| `PCS`       | Piezas      |
| `OTHER`     | Otros       |

El campo es **opcional** y puede ser `null`. Si se envía, debe ser exactamente uno de los valores de la tabla (por ejemplo `"KG"`, `"PCS"`).

---

## Endpoints y métodos HTTP

| Operación       | Método   | Endpoint                      |
|-----------------|----------|-------------------------------|
| Crear gasto     | `POST`   | `/api/expenses`               |
| Listar gastos   | `GET`    | `/api/expenses`               |
| Obtener gasto   | `GET`    | `/api/expenses/:expense_id`   |
| Actualizar gasto| `PUT`    | `/api/expenses/:expense_id`   |
| Eliminar gasto  | `DELETE` | `/api/expenses/:expense_id`   |

Todas las rutas requieren **autenticación**: `Authorization: Bearer <token>`.

---

## Crear gasto

**Request**

```http
POST /api/expenses
Content-Type: application/json
Authorization: Bearer <token>
```

**Body – Gasto sin ítems** (SERVICE_BUSINESS, UTILITY, RENT, OTHER)

| Campo           | Tipo     | Requerido | Descripción |
|-----------------|----------|-----------|-------------|
| `title`         | `string` | **Sí**    | Título del gasto (mín. 1 carácter, máx. 200). |
| `type`         | `string` | Sí        | Uno de: `SERVICE_BUSINESS`, `UTILITY`, `RENT`, `OTHER`. |
| `total`        | `number` | Sí        | Total del gasto (positivo, máx. 2 decimales). |
| `subtotal`     | `number` | Sí        | Subtotal (positivo, máx. 2 decimales). |
| `iva`          | `number` | Sí        | IVA (≥ 0, máx. 2 decimales). |
| `paymentMethod`| `number` | Sí        | 1 = Efectivo, 2 = Transferencia, 3 = Tarjeta. |
| `userId`       | `string` | Sí        | UUID del usuario que registra el gasto. |
| `date`         | `string` | No        | Fecha en ISO. Por defecto: ahora. |
| `description`  | `string` \| `null` | No | Descripción (máx. 500 caracteres). |

**Ejemplo (gasto sin ítems):**

```json
{
  "title": "Pago luz enero",
  "type": "UTILITY",
  "total": 150.50,
  "subtotal": 130.00,
  "iva": 20.50,
  "paymentMethod": 1,
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "description": "Pago luz enero"
}
```

**Body – Gasto tipo MERCHANDISE** (con ítems)

Además de **`title`** (obligatorio) y los campos anteriores con `type: "MERCHANDISE"`, se envía **`items`** (array obligatorio):

| Campo                 | Tipo     | Requerido | Descripción |
|-----------------------|----------|-----------|-------------|
| `items`               | `array`  | Sí        | Lista de productos. |
| `items[].productId`   | `string` | Sí        | UUID del producto (debe existir). |
| `items[].amount`      | `number` | Sí        | Cantidad (positivo, máx. 2 decimales). |
| `items[].subtotal`    | `number` | Sí        | Subtotal del ítem. |
| `items[].total`       | `number` | Sí        | Total del ítem. |
| `items[].unitOfMeasure` | `string` \| `null` | No | Uno de: `KG`, `G`, `PCS`, `OTHER`. |

**Ejemplo (MERCHANDISE):**

```json
{
  "title": "Compra insumos",
  "type": "MERCHANDISE",
  "total": 264.78,
  "subtotal": 230.00,
  "iva": 34.78,
  "paymentMethod": 2,
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "description": "Compra insumos",
  "items": [
    {
      "productId": "660e8400-e29b-41d4-a716-446655440001",
      "amount": 2,
      "subtotal": 100.00,
      "total": 116.00,
      "unitOfMeasure": "KG"
    },
    {
      "productId": "660e8400-e29b-41d4-a716-446655440002",
      "amount": 10,
      "subtotal": 130.00,
      "total": 148.78,
      "unitOfMeasure": "PCS"
    }
  ]
}
```

**Response 200** – Incluye `expense` (con `title`) y, si es MERCHANDISE, `items`.

---

## Obtener gasto

**Request:** `GET /api/expenses/:expense_id`  
**Response 200:** Objeto del gasto (incluye `title`); si el tipo es MERCHANDISE, incluye el array `items` con `unitOfMeasure` (KG, G, PCS u OTHER).

---

## Listar gastos

**Request:** `GET /api/expenses?type=UTILITY&userId=...&paymentMethod=1&dateFrom=2026-01-01&dateTo=2026-01-31&page=1&pageSize=20`

**Query params (todos opcionales):** `type`, `userId`, `paymentMethod`, `dateFrom`, `dateTo`, `page`, `pageSize`.

**Response 200:** `{ data: ExpenseListItem[], pagination: { page, pageSize, total, totalPages } }`. Cada ítem incluye `title`, `userId` y **`userName`** (nombre completo del usuario: nombre + apellidos, join con User). El listado no incluye los ítems de cada gasto; para ver ítems usar `GET /api/expenses/:expense_id`.

---

## Actualizar gasto

**Request:** `PUT /api/expenses/:expense_id`  
**Body (todos opcionales):** `title`, `date`, `total`, `subtotal`, `iva`, `description`, `paymentMethod`. No se puede cambiar el tipo ni los ítems.

---

## Eliminar gasto

**Request:** `DELETE /api/expenses/:expense_id`  
**Response:** 200 OK (o 204). El gasto y sus ítems se eliminan en cascada.

---

## Interfaces TypeScript

```typescript
// Tipos de gasto (enum del backend)
type ExpenseType =
  | 'SERVICE_BUSINESS'
  | 'UTILITY'
  | 'RENT'
  | 'MERCHANDISE'
  | 'OTHER';

// Método de pago: 1 = Efectivo, 2 = Transferencia, 3 = Tarjeta
type PaymentMethodExpense = 1 | 2 | 3;

// Unidades de medida: Kilogramos, Gramos, Piezas, Otros (enum del backend)
type UnitOfMeasure = 'KG' | 'G' | 'PCS' | 'OTHER';

// --- Crear gasto sin ítems ---
interface CreateExpenseRequestNoItems {
  title: string;  // Obligatorio, mín. 1 carácter, máx. 200
  type: 'SERVICE_BUSINESS' | 'UTILITY' | 'RENT' | 'OTHER';
  total: number;
  subtotal: number;
  iva: number;
  paymentMethod: PaymentMethodExpense;
  userId: string;
  date?: string;
  description?: string | null;
}

// --- Ítem de mercancía ---
interface CreateExpenseItemRequest {
  productId: string;
  amount: number;
  subtotal: number;
  total: number;
  unitOfMeasure?: UnitOfMeasure | null;
}

// --- Crear gasto MERCHANDISE ---
interface CreateExpenseRequestMerchandise {
  title: string;  // Obligatorio, mín. 1 carácter, máx. 200
  type: 'MERCHANDISE';
  total: number;
  subtotal: number;
  iva: number;
  paymentMethod: PaymentMethodExpense;
  userId: string;
  date?: string;
  description?: string | null;
  items: CreateExpenseItemRequest[];
}

type CreateExpenseRequest =
  | CreateExpenseRequestNoItems
  | CreateExpenseRequestMerchandise;

// --- Gasto (detalle / get / update) ---
interface Expense {
  id: string;
  title: string;
  type: ExpenseType;
  date: string;
  total: number;
  subtotal: number;
  iva: number;
  description: string | null;
  paymentMethod: number;
  userId: string;
  /** Nombre completo del usuario (solo en listado GET /api/expenses). */
  userName?: string;
  createdAt: string;
  updatedAt: string;
  items?: Array<{
    id: string;
    productId: string;
    amount: number;
    subtotal: number;
    total: number;
    unitOfMeasure: UnitOfMeasure | null;
  }>;
}

// --- Listar ---
interface ListExpensesQuery {
  type?: ExpenseType;
  userId?: string;
  paymentMethod?: PaymentMethodExpense;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

interface ListExpensesResult {
  data: Array<Omit<Expense, 'items' | 'updatedAt'>>;
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

// --- Actualizar ---
interface UpdateExpenseRequest {
  title?: string;  // Opcional, mín. 1 carácter, máx. 200
  date?: string;
  total?: number;
  subtotal?: number;
  iva?: number;
  description?: string | null;
  paymentMethod?: PaymentMethodExpense;
}
```

---

## Validaciones y errores

- **title**: Obligatorio en creación. Mínimo 1 carácter, máximo 200.
- **type**: Obligatorio. Si es MERCHANDISE, `items` es obligatorio y no vacío; para el resto de tipos no se envía `items`.
- **total, subtotal, iva**: Positivos (iva ≥ 0), máximo 2 decimales.
- **paymentMethod**: 1, 2 o 3.
- **userId**: UUID válido.
- **unitOfMeasure**: Solo para ítems MERCHANDISE; si se envía, debe ser `KG`, `G`, `PCS` o `OTHER`. Cualquier otro valor devuelve 400.

| Código               | HTTP | Descripción |
|----------------------|------|-------------|
| `EXPENSE_NOT_FOUND`  | 404  | Gasto no encontrado. |
| `PRODUCT_NOT_FOUND`  | 404  | Algún `productId` en ítems no existe. |
| `VALIDATION_ERROR`  | 400  | Ítems requeridos para MERCHANDISE o ítems no permitidos para otros tipos. |
| `SUBTOTAL_MISMATCH`  | 400  | Suma de subtotales de ítems ≠ subtotal del gasto. |
| `IVA_MISMATCH`       | 400  | IVA calculado ≠ IVA del gasto. |
| `TOTAL_MISMATCH`     | 400  | Suma de totales de ítems ≠ total del gasto. |

---

## Ejemplos de implementación

**Crear gasto MERCHANDISE con unidades:**

```typescript
const createExpenseMerchandise = async (
  payload: CreateExpenseRequestMerchandise,
  token: string
) => {
  const res = await fetch('/api/expenses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message ?? 'Error al crear gasto');
  return json.data;
};

// Ejemplo: ítem en Kilogramos, otro en Piezas
const payload: CreateExpenseRequestMerchandise = {
  title: 'Compra insumos',
  type: 'MERCHANDISE',
  total: 264.78,
  subtotal: 230.00,
  iva: 34.78,
  paymentMethod: 2,
  userId: currentUserId,
  description: 'Compra insumos',
  items: [
    { productId: '...', amount: 2, subtotal: 100, total: 116, unitOfMeasure: 'KG' },
    { productId: '...', amount: 10, subtotal: 130, total: 148.78, unitOfMeasure: 'PCS' },
  ],
};
```

**Listar gastos:**

```typescript
const listExpenses = async (query: ListExpensesQuery, token: string) => {
  const params = new URLSearchParams();
  if (query.type) params.set('type', query.type);
  if (query.userId) params.set('userId', query.userId);
  if (query.paymentMethod != null) params.set('paymentMethod', String(query.paymentMethod));
  if (query.dateFrom) params.set('dateFrom', query.dateFrom);
  if (query.dateTo) params.set('dateTo', query.dateTo);
  if (query.page != null) params.set('page', String(query.page));
  if (query.pageSize != null) params.set('pageSize', String(query.pageSize));

  const res = await fetch(`/api/expenses?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message ?? 'Error al listar gastos');
  return json.data;
};
```

---

## Resumen

- **Base:** Todas las operaciones sobre `/api/expenses` con autenticación.
- **Título:** Obligatorio en creación (mín. 1, máx. 200 caracteres). Opcional en actualización.
- **Tipos:** SERVICE_BUSINESS, UTILITY, RENT, MERCHANDISE, OTHER. Solo MERCHANDISE lleva `items`.
- **Unidades de medida** (solo ítems MERCHANDISE): **KG** (Kilogramos), **G** (Gramos), **PCS** (Piezas), **OTHER** (Otros). Opcional; si se envía, debe ser uno de esos cuatro valores.
- **Crear:** Body con `title` + según tipo; para MERCHANDISE incluir `items` y respetar coincidencia de subtotal/iva/total.
- **Listar:** Query params opcionales (type, userId, paymentMethod, dateFrom, dateTo, page, pageSize).
- **Detalle:** `GET /api/expenses/:expense_id` devuelve el gasto y, si es MERCHANDISE, sus ítems con `unitOfMeasure`.
