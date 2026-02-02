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
  tableNumber?: number | null; // numberTable when order has tableId
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

export interface DashboardResponse {
  salesToday: number;
  salesLast7Days: DashboardSalesLast7Days;
  activeOrders: DashboardActiveOrders;
  recentOrders: DashboardOrderSummary[];
  lastCompletedOrders: DashboardOrderSummary[];
}
