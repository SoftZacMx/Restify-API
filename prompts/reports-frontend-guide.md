# Guía Frontend - Módulo de Reportes

Guía para consumir el **módulo de reportes** desde el frontend: generación de reportes por tipo (flujo de caja, desempeño de ventas, análisis de gastos) con filtros de fecha opcionales.

**Base URL:** `http://localhost:3000/api`

---

## Índice

1. [Contexto y tipos de reporte](#contexto-y-tipos-de-reporte)
2. [Endpoint y parámetros](#endpoint-y-parámetros)
3. [Estructura común de la respuesta](#estructura-común-de-la-respuesta)
4. [CASH_FLOW – Flujo de caja](#cash_flow--flujo-de-caja)
5. [SALES_PERFORMANCE – Desempeño de ventas](#sales_performance--desempeño-de-ventas)
6. [EXPENSE_ANALYSIS – Análisis de gastos](#expense_analysis--análisis-de-gastos)
7. [Interfaces TypeScript](#interfaces-typescript)
8. [Errores y autenticación](#errores-y-autenticación)
9. [Ejemplo de implementación](#ejemplo-de-implementación)

---

## Contexto y tipos de reporte

El backend expone un único endpoint que genera reportes según el `type` enviado en query params:

| Tipo (API)           | Descripción |
|----------------------|-------------|
| `CASH_FLOW`          | Flujo de caja: ingresos (órdenes pagadas), gastos (servicios, mercancía, nómina, propinas), balance y estado. |
| `SALES_PERFORMANCE`  | Desempeño de ventas: ventas por ítem del menú (cantidad, total, % del total), resumen y mejor vendido. |
| `EXPENSE_ANALYSIS`   | Análisis de gastos: gastos por categoría (servicios, utilidades, renta, mercancía, otros, nómina), totales, % y método de pago. |

Todos los reportes aceptan **filtros de fecha** (`dateFrom`, `dateTo`) para acotar el período. Las fechas en la respuesta vienen en formato ISO 8601 (el backend puede serializar `Date` como string).

---

## Endpoint y parámetros

| Operación        | Método | Endpoint         |
|------------------|--------|------------------|
| Generar reporte  | `GET`  | `/api/reports`   |

**Query params:**

| Parámetro  | Tipo   | Requerido | Descripción |
|------------|--------|-----------|-------------|
| `type`     | string | **Sí**    | Uno de: `CASH_FLOW`, `SALES_PERFORMANCE`, `EXPENSE_ANALYSIS`. |
| `dateFrom` | string | No        | Fecha inicio (ISO). Ej: `2026-01-01`. |
| `dateTo`   | string | No        | Fecha fin (ISO). Ej: `2026-01-31`. |
| `page`     | string | No        | Número de página (dígitos). |
| `pageSize` | string | No        | Tamaño de página (dígitos). Máx. 100. |

Requiere **autenticación**: `Authorization: Bearer <token>`.

**Ejemplo:**

```http
GET /api/reports?type=CASH_FLOW&dateFrom=2026-01-01&dateTo=2026-01-31
Authorization: Bearer <token>
```

---

## Estructura común de la respuesta

El backend devuelve el reporte dentro de `data` (formato estándar de la API). La estructura de `data` es:

```json
{
  "success": true,
  "data": {
    "type": "CASH_FLOW",
    "generatedAt": "2026-01-31T18:00:00.000Z",
    "filters": {
      "dateFrom": "2026-01-01T00:00:00.000Z",
      "dateTo": "2026-01-31T23:59:59.999Z"
    },
    "data": { ... }
  }
}
```

- **`type`**: Tipo de reporte generado.
- **`generatedAt`**: Fecha/hora de generación (ISO).
- **`filters`**: Filtros aplicados (`dateFrom`, `dateTo`; pueden ser `null` si no se enviaron).
- **`data`**: Contenido específico del reporte (ver secciones por tipo).
- **`pagination`**: Opcional; solo si el reporte lo incluye.

---

## CASH_FLOW – Flujo de caja

**Request:** `GET /api/reports?type=CASH_FLOW&dateFrom=2026-01-01&dateTo=2026-01-31`

**`data.data`** tiene esta forma:

- **incomes**: Ingresos por órdenes pagadas.
  - **orders**: Array de `{ id, date, total, paymentMethod }` (paymentMethod: 1=Efectivo, 2=Transferencia, 3=Tarjeta, null=dividido).
  - **totalIncomes**: Suma de totales de órdenes.
  - **byPaymentMethod**: `{ cash, transfer, card }` (sumas por método).
- **expenses**: Gastos desglosados.
  - **businessServices**: `{ items: [{ id, date, total, type, description }], total }`.
  - **merchandise**: `{ items: [{ id, date, total, description }], total }`.
  - **employeeSalaries**: `{ items: [{ id, date, amount }], total }`.
  - **tips**: `{ orders: [{ id, date, tip }], total }`.
  - **totalExpenses**: Suma de todos los gastos.
- **cashFlow**: `{ balance: number (ingresos - gastos), status: "POSITIVE" | "NEGATIVE" | "BREAK_EVEN" }`.

Útil para: resumen de caja, gráficos de ingresos vs gastos, indicador de balance.

---

## SALES_PERFORMANCE – Desempeño de ventas

**Request:** `GET /api/reports?type=SALES_PERFORMANCE&dateFrom=2026-01-01&dateTo=2026-01-31`

**`data.data`** tiene esta forma:

- **sales**: Array de ítems del menú vendidos.
  - Cada ítem: `{ menuItemId, menuItemName, unitPrice, quantitySold, totalSold, percentageOfTotal }`.
  - Ordenado por `totalSold` descendente.
- **totalSold**: Suma total vendida en el período.
- **summary**:
  - **totalMenuItems**: Cantidad de ítems del menú con ventas.
  - **averagePrice**: Precio promedio (por ítem).
  - **topSeller**: `{ menuItemId, menuItemName, totalSold }` o `null` si no hay ventas.

Útil para: tablas o gráficos de productos más vendidos, porcentaje sobre el total, destacar el mejor vendido.

---

## EXPENSE_ANALYSIS – Análisis de gastos

**Request:** `GET /api/reports?type=EXPENSE_ANALYSIS&dateFrom=2026-01-01&dateTo=2026-01-31`

**`data.data`** tiene esta forma:

- **expensesByCategory**: Gastos por tipo (todos con `items`, `total`, `percentage`).
  - **businessServices**, **utilities**, **rent**, **merchandise**, **other**: cada uno con `items: [{ id, date, total, description }]`.
- **employeeSalaries**: `{ items: [{ id, date, amount }], total, percentage }`.
- **summary**:
  - **totalExpenses**: Total de todos los gastos (incl. nómina).
  - **totalByPaymentMethod**: `{ cash, transfer, card }`.
  - **largestExpenseCategory**: Nombre de la categoría con mayor gasto (ej. `"merchandise"`, `"employeeSalaries"`).
  - **averageExpense**: Promedio por concepto (totalExpenses / cantidad de conceptos).

Útil para: gráficos por categoría, comparar métodos de pago, ver la categoría que más pesa.

---

## Interfaces TypeScript

```typescript
export type ReportType = 'CASH_FLOW' | 'SALES_PERFORMANCE' | 'EXPENSE_ANALYSIS';

export interface ReportFilters {
  dateFrom?: string | null;
  dateTo?: string | null;
}

export interface BaseReportResponse<T = unknown> {
  type: ReportType;
  generatedAt: string; // ISO
  filters: ReportFilters;
  data: T;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// CASH_FLOW
export interface CashFlowReportData {
  incomes: {
    orders: Array<{ id: string; date: string; total: number; paymentMethod: number | null }>;
    totalIncomes: number;
    byPaymentMethod: { cash: number; transfer: number; card: number };
  };
  expenses: {
    businessServices: { items: Array<{ id: string; date: string; total: number; type: string; description: string | null }>; total: number };
    merchandise: { items: Array<{ id: string; date: string; total: number; description: string | null }>; total: number };
    employeeSalaries: { items: Array<{ id: string; date: string; amount: number }>; total: number };
    tips: { orders: Array<{ id: string; date: string; tip: number }>; total: number };
    totalExpenses: number;
  };
  cashFlow: { balance: number; status: 'POSITIVE' | 'NEGATIVE' | 'BREAK_EVEN' };
}

// SALES_PERFORMANCE
export interface SalesPerformanceReportData {
  sales: Array<{
    menuItemId: string;
    menuItemName: string;
    unitPrice: number;
    quantitySold: number;
    totalSold: number;
    percentageOfTotal: number;
  }>;
  totalSold: number;
  summary: {
    totalMenuItems: number;
    averagePrice: number;
    topSeller: { menuItemId: string; menuItemName: string; totalSold: number } | null;
  };
}

// EXPENSE_ANALYSIS
export interface ExpenseCategoryData {
  items: Array<{ id: string; date: string; total: number; description: string | null }>;
  total: number;
  percentage: number;
}

export interface ExpenseAnalysisReportData {
  expensesByCategory: {
    businessServices: ExpenseCategoryData;
    utilities: ExpenseCategoryData;
    rent: ExpenseCategoryData;
    merchandise: ExpenseCategoryData;
    other: ExpenseCategoryData;
  };
  employeeSalaries: { items: Array<{ id: string; date: string; amount: number }>; total: number; percentage: number };
  summary: {
    totalExpenses: number;
    totalByPaymentMethod: { cash: number; transfer: number; card: number };
    largestExpenseCategory: string;
    averageExpense: number;
  };
}

// Respuesta envuelta por el backend
export interface ReportsApiResponse<T = unknown> {
  success: boolean;
  data: BaseReportResponse<T>;
}
```

---

## Errores y autenticación

- **401 Unauthorized:** Token ausente o inválido.
- **400 Bad Request:** `type` ausente, inválido o no soportado; o `dateFrom` > `dateTo`. El backend puede devolver mensaje de validación (ej. Zod).
- **404 / REPORT_TYPE_NOT_FOUND:** Tipo de reporte no soportado (en la práctica, si se usa solo los tres tipos anteriores no debería ocurrir).

Siempre enviar `Authorization: Bearer <token>`.

---

## Ejemplo de implementación

```typescript
const API_BASE = 'http://localhost:3000/api';

export type ReportType = 'CASH_FLOW' | 'SALES_PERFORMANCE' | 'EXPENSE_ANALYSIS';

interface GenerateReportParams {
  type: ReportType;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

async function generateReport<T = unknown>(
  token: string,
  params: GenerateReportParams
): Promise<{ type: ReportType; generatedAt: string; filters: any; data: T }> {
  const searchParams = new URLSearchParams();
  searchParams.set('type', params.type);
  if (params.dateFrom) searchParams.set('dateFrom', params.dateFrom);
  if (params.dateTo) searchParams.set('dateTo', params.dateTo);
  if (params.page != null) searchParams.set('page', String(params.page));
  if (params.pageSize != null) searchParams.set('pageSize', String(params.pageSize));

  const res = await fetch(`${API_BASE}/reports?${searchParams.toString()}`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!res.ok) {
    if (res.status === 401) throw new Error('No autorizado');
    if (res.status === 400) throw new Error('Parámetros inválidos');
    throw new Error('Error al generar el reporte');
  }

  const json = await res.json();
  if (!json.success || !json.data) throw new Error('Respuesta inválida');
  return json.data;
}

// Uso: reporte de flujo de caja
const cashFlow = await generateReport<CashFlowReportData>(token, {
  type: 'CASH_FLOW',
  dateFrom: '2026-01-01',
  dateTo: '2026-01-31',
});
console.log(cashFlow.data.cashFlow.balance, cashFlow.data.cashFlow.status);
```

Para **SALES_PERFORMANCE** y **EXPENSE_ANALYSIS** se usa el mismo `generateReport` cambiando `type` y el genérico (por ejemplo `generateReport<SalesPerformanceReportData>(token, { type: 'SALES_PERFORMANCE', ... })`).
