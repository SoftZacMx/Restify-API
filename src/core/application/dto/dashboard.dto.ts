/**
 * Dashboard API - GET /api/dashboard
 * No request body; optional query params in the future (e.g. dateFrom, dateTo).
 */

export interface DashboardOrderSummary {
  id: string;
  total: number;
  date: string; // ISO 8601
  origin: string;
  tableId: string | null;
  /** Nombre de la mesa cuando la orden tiene tableId */
  tableName?: string | null;
  status: boolean;
  delivered: boolean;
}

export interface DashboardSalesByDayItem {
  date: string; // YYYY-MM-DD
  day: string; // Weekday name in English: Monday, Tuesday, ...
  total: number;
}

export interface DashboardSalesLast7Days {
  total: number;
  byDay: DashboardSalesByDayItem[];
}

export interface DashboardActiveOrders {
  count: number;
  items: DashboardOrderSummary[];
}

export interface DashboardOccupiedTable {
  id: string;
  name: string;
}

export interface DashboardOccupiedTables {
  count: number;
  items: DashboardOccupiedTable[];
}

export interface DashboardResponse {
  salesToday: number;
  salesLast7Days: DashboardSalesLast7Days;
  activeOrders: DashboardActiveOrders;
  occupiedTables: DashboardOccupiedTables;
  recentOrders: DashboardOrderSummary[];
  lastCompletedOrders: DashboardOrderSummary[];
}
