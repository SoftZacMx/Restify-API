import { GetDashboardUseCase } from '../../../../src/core/application/use-cases/dashboard/get-dashboard.use-case';
import { IOrderRepository } from '../../../../src/core/domain/interfaces/order-repository.interface';
import { ITableRepository } from '../../../../src/core/domain/interfaces/table-repository.interface';
import { BranchTimezoneService } from '../../../../src/core/application/services/branch-timezone.service';
import { Order } from '../../../../src/core/domain/entities/order.entity';
import { Table } from '../../../../src/core/domain/entities/table.entity';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('GetDashboardUseCase', () => {
  let useCase: GetDashboardUseCase;
  let orderRepository: jest.Mocked<IOrderRepository>;
  let tableRepository: jest.Mocked<ITableRepository>;
  let branchTimezoneService: jest.Mocked<BranchTimezoneService>;

  beforeEach(() => {
    orderRepository = {
      findById: jest.fn(),
      findByTrackingToken: jest.fn(),
      findAll: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      createOrderItem: jest.fn(),
      updateOrderItem: jest.fn(),
      deleteOrderItem: jest.fn(),
      deleteOrderItemsByOrderId: jest.fn(),
      findOrderItemsByOrderId: jest.fn(),
      createOrderItemExtra: jest.fn(),
      deleteOrderItemExtrasByOrderId: jest.fn(),
      deleteOrderItemExtrasByOrderItemId: jest.fn(),
      findOrderItemExtrasByOrderId: jest.fn(),
      findOrderItemExtrasByOrderItemId: jest.fn(),
    };
    tableRepository = {
      findById: jest.fn(),
      findByName: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    branchTimezoneService = {
      get: jest.fn().mockResolvedValue('America/Mexico_City'),
    } as unknown as jest.Mocked<BranchTimezoneService>;

    useCase = new GetDashboardUseCase(orderRepository, tableRepository, branchTimezoneService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  function makeOrder(overrides: Record<string, any> = {}): Order {
    return new Order(
      overrides.id ?? 'order-1',
      overrides.date ?? new Date(),
      overrides.status ?? false,
      overrides.paymentMethod ?? 1,
      overrides.total ?? 0,
      overrides.subtotal ?? 0,
      overrides.iva ?? 0,
      overrides.delivered ?? false,
      overrides.tableId ?? null,
      overrides.tip ?? 0,
      overrides.origin ?? 'local',
      overrides.client ?? null,
      overrides.paymentDiffer ?? false,
      overrides.note ?? null,
      overrides.userId ?? null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      overrides.branchId ?? null,
      new Date(),
      new Date()
    );
  }

  function makeTable(id: string, name: string): Table {
    return new Table(id, name, 'user-1', true, true, new Date(), new Date());
  }

  it('arma el dashboard con ventas, ventas por día, activas, ocupadas, recientes y completadas', async () => {
    const today = new Date();
    const paidToday = makeOrder({
      id: 'o1',
      status: true,
      total: 100,
      date: today,
      tableId: 'table-1',
      delivered: true,
    });
    const last7 = [
      makeOrder({ id: 'o2', status: true, total: 50, date: today }),
      makeOrder({ id: 'o2b', status: true, total: 30, date: today }),
      makeOrder({ id: 'o3', status: true, total: 25, date: new Date(today.getTime() - 3 * DAY_MS) }),
    ];
    const active = [
      makeOrder({ id: 'o4', status: false, tableId: 'table-1' }),
      makeOrder({ id: 'o5', status: false, tableId: null }),
    ];
    const recent = [
      makeOrder({ id: 'o6', tableId: 'table-1' }),
      makeOrder({ id: 'o7', tableId: 'ghost-table' }),
    ];
    const completed = [
      makeOrder({ id: 'o8', status: true, delivered: true, total: 10, tableId: 'table-1' }),
      makeOrder({ id: 'o9', status: true, delivered: false, total: 20 }),
    ];

    orderRepository.findAll
      .mockResolvedValueOnce([paidToday])
      .mockResolvedValueOnce(last7)
      .mockResolvedValueOnce(active)
      .mockResolvedValueOnce(recent)
      .mockResolvedValueOnce(completed);
    tableRepository.findAll
      .mockResolvedValueOnce([makeTable('table-1', 'Mesa 1'), makeTable('table-2', 'Mesa 2')])
      .mockResolvedValueOnce([makeTable('table-1', 'Mesa 1')]);

    const result = await useCase.execute();

    expect(branchTimezoneService.get).toHaveBeenCalledTimes(1);
    expect(result.salesToday).toBe(100);
    expect(result.salesLast7Days.total).toBe(105);
    expect(result.salesLast7Days.byDay).toHaveLength(7);
    expect(result.salesLast7Days.byDay.every((d) => d.total >= 0)).toBe(true);
    expect(result.activeOrders).toEqual({
      count: 2,
      items: [
        expect.objectContaining({ id: 'o4', tableId: 'table-1', tableName: 'Mesa 1' }),
        expect.objectContaining({ id: 'o5', tableName: null }),
      ],
    });
    expect(result.occupiedTables).toEqual({
      count: 2,
      items: [
        { id: 'table-1', name: 'Mesa 1' },
        { id: 'table-2', name: 'Mesa 2' },
      ],
    });
    expect(result.recentOrders).toHaveLength(2);
    expect(result.recentOrders[0]).toEqual(
      expect.objectContaining({ id: 'o6', tableName: 'Mesa 1' })
    );
    expect(result.recentOrders[1]).toEqual(expect.objectContaining({ id: 'o7', tableName: null }));
    expect(result.lastCompletedOrders).toEqual([expect.objectContaining({ id: 'o8' })]);
  });

  it('devuelve ceros y listas vacías cuando no hay datos', async () => {
    orderRepository.findAll.mockResolvedValue([]);
    tableRepository.findAll.mockResolvedValue([]);

    const result = await useCase.execute();

    expect(result.salesToday).toBe(0);
    expect(result.salesLast7Days.total).toBe(0);
    expect(result.salesLast7Days.byDay).toHaveLength(7);
    expect(result.salesLast7Days.byDay.every((d) => d.total === 0)).toBe(true);
    expect(result.activeOrders).toEqual({ count: 0, items: [] });
    expect(result.occupiedTables).toEqual({ count: 0, items: [] });
    expect(result.recentOrders).toEqual([]);
    expect(result.lastCompletedOrders).toEqual([]);
  });
});
