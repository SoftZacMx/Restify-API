import { PrismaClient } from '@prisma/client';
import { ExpenseType } from '@prisma/client';
import { formatInTimeZone } from 'date-fns-tz';
import type {
  ReportsSummaryResponse,
  ReportsSummaryKpis,
  SalesByDayItem,
  PaymentDistributionItem,
  TopProductItem,
  ExpenseByCategoryItem,
  DailyTableRow,
} from '../../../application/dto/reports-summary.dto';
import type { IReportsSummaryRepository } from '../../../domain/interfaces/reports-summary-repository.interface';
import { APP_TIMEZONE } from '../../../../shared/constants';

const PAYMENT_LABELS: Record<number, string> = {
  1: 'Efectivo',
  2: 'Transferencia',
  3: 'Tarjeta',
  4: 'QR Mercado Pago',
};

const EXPENSE_TYPE_LABELS: Record<ExpenseType, string> = {
  SERVICE_BUSINESS: 'Servicios',
  UTILITY: 'Servicios públicos',
  RENT: 'Renta',
  MERCHANDISE: 'Insumos',
  SALARY: 'Nómina',
  OTHER: 'Otros',
};

/** Key as YYYY-MM-DD in the app timezone (APP_TIMEZONE). */
function toDateKey(d: Date): string {
  return formatInTimeZone(d, APP_TIMEZONE, 'yyyy-MM-dd');
}

/** Alias de toDateKey. Se mantiene para compatibilidad con callers existentes. */
function toDateKeyLocal(d: Date): string {
  return toDateKey(d);
}

function getWeekLabel(dateStr: string, start: Date): string {
  const d = new Date(dateStr);
  const diffDays = Math.floor((d.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  const weekNum = Math.floor(diffDays / 7) + 1;
  return `Semana ${weekNum}`;
}

export class ReportsSummaryRepository implements IReportsSummaryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getSummary(dateFrom: Date, dateTo: Date): Promise<ReportsSummaryResponse> {
    const dateFromStr = toDateKey(dateFrom);
    const dateToStr = toDateKey(dateTo);

    const periodDays = this.daysDiff(dateFrom, dateTo);
    const prevEnd = this.addDays(dateFrom, -1);
    const prevStart = this.addDays(dateFrom, -periodDays);

    const [orders, expenses, previousOrders, previousExpenses] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          status: true,
          date: { gte: dateFrom, lte: dateTo },
        },
        select: {
          id: true,
          date: true,
          total: true,
          paymentMethod: true,
        },
      }),
      this.prisma.expense.findMany({
        where: {
          date: { gte: dateFrom, lte: dateTo },
        },
        select: { id: true, date: true, total: true, type: true },
      }),
      this.getOrdersInRange(prevStart, prevEnd),
      this.getExpensesInRange(prevStart, prevEnd),
    ]);

    const orderIds = orders.map((o) => o.id);
    let orderItemsWithMenuFiltered: Array<{ orderId: string; quantity: number; price: unknown; menuItemId: string | null; menuItem: { id: string; name: string } | null }> = [];
    if (orderIds.length > 0) {
      orderItemsWithMenuFiltered = await this.prisma.orderItem.findMany({
        where: {
          orderId: { in: orderIds },
          menuItemId: { not: null },
        },
        include: { menuItem: { select: { id: true, name: true } } },
      });
    }

    const totalSales = orders.reduce((sum, o) => sum + Number(o.total), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.total), 0);
    const netProfit = totalSales - totalExpenses;
    const ordersCount = orders.length;
    const averagePerOrder = ordersCount > 0 ? totalSales / ordersCount : 0;

    const prevTotalSales = previousOrders.reduce((sum, o) => sum + Number(o.total), 0);
    const prevTotalExpenses = previousExpenses.reduce((sum, e) => sum + Number(e.total), 0);
    const prevOrdersCount = previousOrders.length;
    const prevAveragePerOrder = prevOrdersCount > 0 ? prevTotalSales / prevOrdersCount : 0;
    const prevNetProfit = prevTotalSales - prevTotalExpenses;

    const kpis: ReportsSummaryKpis = {
      totalSales,
      totalSalesChangePercent: prevTotalSales > 0 ? ((totalSales - prevTotalSales) / prevTotalSales) * 100 : 0,
      ordersProcessed: ordersCount,
      ordersProcessedChangePercent: prevOrdersCount > 0 ? ((ordersCount - prevOrdersCount) / prevOrdersCount) * 100 : 0,
      averagePerOrder,
      averagePerOrderChangePercent: prevAveragePerOrder > 0 ? ((averagePerOrder - prevAveragePerOrder) / prevAveragePerOrder) * 100 : 0,
      totalExpenses,
      totalExpensesChangePercent: prevTotalExpenses > 0 ? ((totalExpenses - prevTotalExpenses) / prevTotalExpenses) * 100 : 0,
      netProfit,
      netProfitChangePercent: prevNetProfit !== 0 ? ((netProfit - prevNetProfit) / Math.abs(prevNetProfit)) * 100 : 0,
    };

    const salesByDayMap = new Map<string, number>();
    for (const o of orders) {
      const key = toDateKeyLocal(o.date);
      salesByDayMap.set(key, (salesByDayMap.get(key) ?? 0) + Number(o.total));
    }
    const rangeStart = new Date(dateFromStr + 'T12:00:00');
    const rangeEnd = new Date(dateToStr + 'T12:00:00');
    const salesOverTime: SalesByDayItem[] = [];
    for (let d = new Date(rangeStart); d <= rangeEnd; d.setDate(d.getDate() + 1)) {
      const key = toDateKeyLocal(d);
      salesOverTime.push({
        date: key,
        label: getWeekLabel(key, rangeStart),
        total: salesByDayMap.get(key) ?? 0,
      });
    }

    const paymentMap = new Map<number, { total: number; count: number }>();
    for (const o of orders) {
      const method = o.paymentMethod ?? 0;
      const current = paymentMap.get(method) ?? { total: 0, count: 0 };
      current.total += Number(o.total);
      current.count += 1;
      paymentMap.set(method, current);
    }
    const paymentTotal = orders.reduce((s, o) => s + Number(o.total), 0);
    const paymentDistribution: PaymentDistributionItem[] = [1, 2, 3, 4].map((method) => {
      const data = paymentMap.get(method) ?? { total: 0, count: 0 };
      return {
        method: method === 1 ? 'CASH' : method === 2 ? 'TRANSFER' : method === 3 ? 'CARD' : 'QR_MERCADO_PAGO',
        label: PAYMENT_LABELS[method] ?? 'Otro',
        total: data.total,
        count: data.count,
        percentage: paymentTotal > 0 ? (data.total / paymentTotal) * 100 : 0,
      };
    });

    const menuItemAgg = new Map<string, { name: string; quantity: number; totalSales: number }>();
    for (const oi of orderItemsWithMenuFiltered) {
      if (!oi.menuItemId || !oi.menuItem) continue;
      const id = oi.menuItemId;
      const current = menuItemAgg.get(id) ?? { name: oi.menuItem.name, quantity: 0, totalSales: 0 };
      current.quantity += oi.quantity;
      current.totalSales += oi.quantity * Number(oi.price);
      menuItemAgg.set(id, current);
    }
    const topProducts: TopProductItem[] = Array.from(menuItemAgg.entries())
      .map(([menuItemId, v]) => ({ menuItemId, name: v.name, quantitySold: v.quantity, totalSales: v.totalSales }))
      .sort((a, b) => b.quantitySold - a.quantitySold)
      .slice(0, 5);

    const expenseByTypeMap = new Map<string, number>();
    for (const e of expenses) {
      const t = e.type as ExpenseType;
      expenseByTypeMap.set(t, (expenseByTypeMap.get(t) ?? 0) + Number(e.total));
    }
    const expenseByCategory: ExpenseByCategoryItem[] = Array.from(expenseByTypeMap.entries()).map(([type, total]) => ({
      type,
      label: EXPENSE_TYPE_LABELS[type as ExpenseType] ?? type,
      total,
      percentage: totalExpenses > 0 ? (total / totalExpenses) * 100 : 0,
    }));

    const salesByDayForTable = new Map<string, number>();
    const ordersCountByDay = new Map<string, number>();
    for (const o of orders) {
      const key = toDateKeyLocal(o.date);
      salesByDayForTable.set(key, (salesByDayForTable.get(key) ?? 0) + Number(o.total));
      ordersCountByDay.set(key, (ordersCountByDay.get(key) ?? 0) + 1);
    }
    const expensesByDay = new Map<string, number>();
    for (const e of expenses) {
      const key = toDateKeyLocal(e.date);
      expensesByDay.set(key, (expensesByDay.get(key) ?? 0) + Number(e.total));
    }
    const dailyTable: DailyTableRow[] = [];
    for (let d = new Date(rangeStart); d <= new Date(dateToStr + 'T12:00:00'); d.setDate(d.getDate() + 1)) {
      const key = toDateKeyLocal(d);
      const sales = salesByDayForTable.get(key) ?? 0;
      const orders = ordersCountByDay.get(key) ?? 0;
      const exp = expensesByDay.get(key) ?? 0;
      dailyTable.push({
        date: key,
        sales,
        orders,
        expenses: exp,
        profit: sales - exp,
      });
    }
    dailyTable.sort((a, b) => a.date.localeCompare(b.date));

    return {
      dateFrom: dateFromStr,
      dateTo: dateToStr,
      kpis,
      salesOverTime,
      paymentDistribution,
      topProducts,
      expensesByCategory: expenseByCategory,
      dailyTable,
    };
  }

  private async getOrdersInRange(from: Date, to: Date): Promise<{ total: number }[]> {
    const orders = await this.prisma.order.findMany({
      where: { status: true, date: { gte: from, lte: to } },
      select: { total: true },
    });
    return orders.map((o) => ({ total: Number(o.total) }));
  }

  private async getExpensesInRange(from: Date, to: Date): Promise<{ total: number }[]> {
    const expenses = await this.prisma.expense.findMany({
      where: { date: { gte: from, lte: to } },
      select: { total: true },
    });
    return expenses.map((e) => ({ total: Number(e.total) }));
  }

  private addDays(d: Date, days: number): Date {
    const out = new Date(d);
    out.setDate(out.getDate() + days);
    return out;
  }

  private daysDiff(a: Date, b: Date): number {
    return Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  }
}
