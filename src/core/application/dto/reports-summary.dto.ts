/**
 * Reports summary API - GET /api/reports/summary?dateFrom=&dateTo=
 * Returns JSON for dashboard charts and KPIs.
 */

export interface ReportsSummaryQuery {
  dateFrom?: string; // ISO date YYYY-MM-DD
  dateTo?: string;
}

export interface ReportsSummaryKpis {
  totalSales: number;
  totalSalesChangePercent: number; // vs previous period
  ordersProcessed: number;
  ordersProcessedChangePercent: number;
  averagePerOrder: number;
  averagePerOrderChangePercent: number;
  totalExpenses: number;
  totalExpensesChangePercent: number;
  netProfit: number;
  netProfitChangePercent: number;
}

export interface SalesByDayItem {
  date: string; // YYYY-MM-DD
  label: string; // e.g. "Semana 1", "Semana 2", or day name
  total: number;
}

export interface PaymentDistributionItem {
  method: string; // 'CASH' | 'TRANSFER' | 'CARD'
  label: string; // e.g. "Efectivo", "Tarjeta"
  total: number;
  count: number;
  percentage: number;
}

export interface TopProductItem {
  menuItemId: string;
  name: string;
  quantitySold: number;
  totalSales: number;
}

export interface ExpenseByCategoryItem {
  type: string; // ExpenseType
  label: string;
  total: number;
  percentage: number;
}

export interface DailyTableRow {
  date: string; // YYYY-MM-DD
  sales: number;
  orders: number;
  expenses: number;
  profit: number;
}

export interface ReportsSummaryResponse {
  dateFrom: string;
  dateTo: string;
  kpis: ReportsSummaryKpis;
  salesOverTime: SalesByDayItem[];
  paymentDistribution: PaymentDistributionItem[];
  topProducts: TopProductItem[];
  expensesByCategory: ExpenseByCategoryItem[];
  dailyTable: DailyTableRow[];
}
