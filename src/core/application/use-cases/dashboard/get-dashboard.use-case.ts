import { inject, injectable } from 'tsyringe';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { IOrderRepository } from '../../../domain/interfaces/order-repository.interface';
import { ITableRepository } from '../../../domain/interfaces/table-repository.interface';
import { BranchTimezoneService } from '../../services/branch-timezone.service';
import {
  DashboardResponse,
  DashboardOrderSummary,
  DashboardSalesByDayItem,
} from '../../dto/dashboard.dto';

function dateKey(date: Date, timezone: string): string {
  return formatInTimeZone(date, timezone, 'yyyy-MM-dd');
}

function startOfDay(key: string, timezone: string): Date {
  return fromZonedTime(`${key} 00:00:00.000`, timezone);
}

function endOfDay(key: string, timezone: string): Date {
  return fromZonedTime(`${key} 23:59:59.999`, timezone);
}

function weekdayName(date: Date, timezone: string): string {
  return formatInTimeZone(date, timezone, 'EEEE');
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
    @inject('ITableRepository') private readonly tableRepository: ITableRepository,
    @inject(BranchTimezoneService) private readonly branchTimezoneService: BranchTimezoneService
  ) {}

  async execute(): Promise<DashboardResponse> {
    const timezone = await this.branchTimezoneService.get();

    const now = new Date();
    const todayKey = dateKey(now, timezone);
    const todayStart = startOfDay(todayKey, timezone);
    const todayEnd = endOfDay(todayKey, timezone);
    const sevenDaysAgoKey = dateKey(new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000), timezone);
    const sevenDaysAgoStart = startOfDay(sevenDaysAgoKey, timezone);
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
      const key = dateKey(order.date, timezone);
      byDayMap.set(key, (byDayMap.get(key) ?? 0) + order.total);
    }
    const salesLast7DaysTotal = paidOrdersLast7Days.reduce((sum, o) => sum + o.total, 0);
    const byDay: DashboardSalesByDayItem[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgoStart.getTime() + i * 24 * 60 * 60 * 1000);
      const key = dateKey(d, timezone);
      const total = byDayMap.get(key) ?? 0;
      const dayName = weekdayName(d, timezone);
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
