import { inject, injectable } from 'tsyringe';
import { IOrderRepository } from '../../../domain/interfaces/order-repository.interface';
import { ITableRepository } from '../../../domain/interfaces/table-repository.interface';
import {
  DashboardResponse,
  DashboardOrderSummary,
  DashboardSalesByDayItem,
} from '../../dto/dashboard.dto';

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function startOfDayUTC(d: Date): Date {
  const out = new Date(d);
  out.setUTCHours(0, 0, 0, 0);
  return out;
}

function endOfDayUTC(d: Date): Date {
  const out = new Date(d);
  out.setUTCHours(23, 59, 59, 999);
  return out;
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function orderToSummary(
  order: { id: string; total: number; date: Date; origin: string; tableId: string | null; status: boolean; delivered: boolean },
  tableNumberByTableId: Map<string, number>
): DashboardOrderSummary {
  return {
    id: order.id,
    total: order.total,
    date: order.date.toISOString(),
    origin: order.origin,
    tableId: order.tableId,
    tableNumber: order.tableId ? tableNumberByTableId.get(order.tableId) ?? null : null,
    status: order.status,
    delivered: order.delivered,
  };
}

@injectable()
export class GetDashboardUseCase {
  constructor(
    @inject('IOrderRepository') private readonly orderRepository: IOrderRepository,
    @inject('ITableRepository') private readonly tableRepository: ITableRepository
  ) {}

  async execute(): Promise<DashboardResponse> {
    const now = new Date();
    const todayStart = startOfDayUTC(now);
    const todayEnd = endOfDayUTC(now);
    const sevenDaysAgoStart = startOfDayUTC(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000));
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      paidOrdersToday,
      paidOrdersLast7Days,
      activeOrdersList,
      recentOrdersList,
      paidOrdersForCompleted,
    ] = await Promise.all([
      this.orderRepository.findAll({ status: true, dateFrom: todayStart, dateTo: todayEnd }),
      this.orderRepository.findAll({ status: true, dateFrom: sevenDaysAgoStart, dateTo: todayEnd }),
      this.orderRepository.findAll({ status: false }),
      this.orderRepository.findAll({}), // all orders, already ordered by date desc
      this.orderRepository.findAll({ status: true, dateFrom: thirtyDaysAgo, dateTo: now }),
    ]);

    const salesToday = paidOrdersToday.reduce((sum, o) => sum + o.total, 0);

    const byDayMap = new Map<string, number>();
    for (const order of paidOrdersLast7Days) {
      const key = toDateKey(order.date);
      byDayMap.set(key, (byDayMap.get(key) ?? 0) + order.total);
    }
    const salesLast7DaysTotal = paidOrdersLast7Days.reduce((sum, o) => sum + o.total, 0);
    const byDay: DashboardSalesByDayItem[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgoStart.getTime() + i * 24 * 60 * 60 * 1000);
      const key = toDateKey(d);
      const total = byDayMap.get(key) ?? 0;
      const dayName = WEEKDAY_NAMES[d.getUTCDay()];
      byDay.push({ date: key, day: dayName, total });
    }

    const tableNumberByTableId = new Map<string, number>();
    const allTableIds = new Set<string>();
    for (const order of [...activeOrdersList, ...recentOrdersList, ...paidOrdersForCompleted]) {
      if (order.tableId) allTableIds.add(order.tableId);
    }
    const tablesToResolve = await this.tableRepository.findAll({});
    for (const t of tablesToResolve) {
      tableNumberByTableId.set(t.id, t.numberTable);
    }

    const activeOrdersItems = activeOrdersList.slice(0, 20).map((o) => orderToSummary(o, tableNumberByTableId));
    const recentOrders = recentOrdersList.slice(0, 10).map((o) => orderToSummary(o, tableNumberByTableId));
    const lastCompletedOrders = paidOrdersForCompleted
      .filter((o) => o.delivered)
      .slice(0, 5)
      .map((o) => orderToSummary(o, tableNumberByTableId));

    return {
      salesToday,
      salesLast7Days: { total: salesLast7DaysTotal, byDay },
      activeOrders: { count: activeOrdersList.length, items: activeOrdersItems },
      recentOrders,
      lastCompletedOrders,
    };
  }
}
