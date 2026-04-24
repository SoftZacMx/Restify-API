import { inject, injectable } from 'tsyringe';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { IOrderRepository } from '../../../domain/interfaces/order-repository.interface';
import { ITableRepository } from '../../../domain/interfaces/table-repository.interface';
import { APP_TIMEZONE } from '../../../../shared/constants';
import {
  DashboardResponse,
  DashboardOrderSummary,
  DashboardSalesByDayItem,
} from '../../dto/dashboard.dto';

function dateKeyInAppTz(date: Date): string {
  return formatInTimeZone(date, APP_TIMEZONE, 'yyyy-MM-dd');
}

function startOfDayInAppTz(dateKey: string): Date {
  return fromZonedTime(`${dateKey} 00:00:00.000`, APP_TIMEZONE);
}

function endOfDayInAppTz(dateKey: string): Date {
  return fromZonedTime(`${dateKey} 23:59:59.999`, APP_TIMEZONE);
}

function weekdayNameInAppTz(date: Date): string {
  return formatInTimeZone(date, APP_TIMEZONE, 'EEEE');
}

function orderToSummary(
  order: { id: string; total: number; date: Date; origin: string; tableId: string | null; status: boolean; delivered: boolean },
  tableNameByTableId: Map<string, string>
): DashboardOrderSummary {
  return {
    id: order.id,
    total: order.total,
    date: order.date.toISOString(),
    origin: order.origin,
    tableId: order.tableId,
    tableName: order.tableId ? tableNameByTableId.get(order.tableId) ?? null : null,
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
    const todayKey = dateKeyInAppTz(now);
    const todayStart = startOfDayInAppTz(todayKey);
    const todayEnd = endOfDayInAppTz(todayKey);
    const sevenDaysAgoKey = dateKeyInAppTz(new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000));
    const sevenDaysAgoStart = startOfDayInAppTz(sevenDaysAgoKey);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      paidOrdersToday,
      paidOrdersLast7Days,
      activeOrdersList,
      recentOrdersList,
      paidOrdersForCompleted,
      occupiedTablesList,
    ] = await Promise.all([
      this.orderRepository.findAll({ status: true, dateFrom: todayStart, dateTo: todayEnd }),
      this.orderRepository.findAll({ status: true, dateFrom: sevenDaysAgoStart, dateTo: todayEnd }),
      this.orderRepository.findAll({ status: false }),
      this.orderRepository.findAll({}), // all orders, already ordered by date desc
      this.orderRepository.findAll({ status: true, dateFrom: thirtyDaysAgo, dateTo: now }),
      this.tableRepository.findAll({ availabilityStatus: false }),
    ]);

    const salesToday = paidOrdersToday.reduce((sum, o) => sum + o.total, 0);

    const byDayMap = new Map<string, number>();
    for (const order of paidOrdersLast7Days) {
      const key = dateKeyInAppTz(order.date);
      byDayMap.set(key, (byDayMap.get(key) ?? 0) + order.total);
    }
    const salesLast7DaysTotal = paidOrdersLast7Days.reduce((sum, o) => sum + o.total, 0);
    const byDay: DashboardSalesByDayItem[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgoStart.getTime() + i * 24 * 60 * 60 * 1000);
      const key = dateKeyInAppTz(d);
      const total = byDayMap.get(key) ?? 0;
      const dayName = weekdayNameInAppTz(d);
      byDay.push({ date: key, day: dayName, total });
    }

    const tableNameByTableId = new Map<string, string>();
    const tablesToResolve = await this.tableRepository.findAll({});
    for (const t of tablesToResolve) {
      tableNameByTableId.set(t.id, t.name);
    }

    const activeOrdersItems = activeOrdersList.slice(0, 20).map((o) => orderToSummary(o, tableNameByTableId));
    const recentOrders = recentOrdersList.slice(0, 10).map((o) => orderToSummary(o, tableNameByTableId));
    const lastCompletedOrders = paidOrdersForCompleted
      .filter((o) => o.delivered)
      .slice(0, 5)
      .map((o) => orderToSummary(o, tableNameByTableId));

    const occupiedTablesItems = occupiedTablesList.map((t) => ({
      id: t.id,
      name: t.name,
    }));

    return {
      salesToday,
      salesLast7Days: { total: salesLast7DaysTotal, byDay },
      activeOrders: { count: activeOrdersList.length, items: activeOrdersItems },
      occupiedTables: { count: occupiedTablesList.length, items: occupiedTablesItems },
      recentOrders,
      lastCompletedOrders,
    };
  }
}
