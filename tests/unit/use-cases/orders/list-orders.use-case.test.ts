import { ListOrdersUseCase } from '../../../../src/core/application/use-cases/orders/list-orders.use-case';
import {
  IOrderRepository,
  OrderFilters,
} from '../../../../src/core/domain/interfaces/order-repository.interface';
import { Order } from '../../../../src/core/domain/entities/order.entity';

/** Simula total de listado + resumen pendientes/pagadas (mismos filtros que el caso de uso). */
function stubOrderCounts(
  mock: Pick<IOrderRepository, 'count'>,
  listTotal: number,
  pending: number,
  paid: number
): void {
  (mock.count as jest.Mock).mockImplementation(async (f?: OrderFilters) => {
    if (f?.status === false) return pending;
    if (f?.status === true) return paid;
    return listTotal;
  });
}

describe('ListOrdersUseCase', () => {
  let listOrdersUseCase: ListOrdersUseCase;
  let mockOrderRepository: jest.Mocked<IOrderRepository>;

  beforeEach(() => {
    mockOrderRepository = {
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

    listOrdersUseCase = new ListOrdersUseCase(mockOrderRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should return paginated orders when no filters provided', async () => {
      const mockOrders = [
        new Order(
          'order-1',
          new Date(),
          false,
          1,
          23.20,
          20.00,
          3.20,
          false,
          null,
          0,
          'Local',
          null,
          false,
          null,
          'user-123',
          null, null, null, null, null, null, null, null,
          new Date(),
          new Date()
        ),
        new Order(
          'order-2',
          new Date(),
          true,
          2,
          50.00,
          43.10,
          6.90,
          false,
          'table-123',
          0,
          'Delivery',
          'John Doe',
          false,
          null,
          'user-456',
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          new Date(),
          new Date()
        ),
      ];

      mockOrderRepository.findAll.mockResolvedValue(mockOrders);
      stubOrderCounts(mockOrderRepository, 2, 1, 1);

      const result = await listOrdersUseCase.execute();

      expect(result.data).toHaveLength(2);
      expect(result.data[0].id).toBe('order-1');
      expect(result.data[1].id).toBe('order-2');
      expect(result.pagination).toEqual({ page: 1, limit: 20, total: 2, totalPages: 1 });
      expect(result.summary).toEqual({ totalOrdersPending: 1, totalOrdersPaid: 1 });
      expect(mockOrderRepository.findAll).toHaveBeenCalledWith(undefined, { skip: 0, take: 20 });
      expect(mockOrderRepository.count).toHaveBeenCalledWith(undefined);
    });

    it('should return filtered orders by status', async () => {
      const mockOrders = [
        new Order(
          'order-1',
          new Date(),
          true,
          1,
          23.20,
          20.00,
          3.20,
          false,
          null,
          0,
          'Local',
          null,
          false,
          null,
          'user-123',
          null, null, null, null, null, null, null, null,
          new Date(),
          new Date()
        ),
      ];

      mockOrderRepository.findAll.mockResolvedValue(mockOrders);
      stubOrderCounts(mockOrderRepository, 1, 0, 1);

      const result = await listOrdersUseCase.execute({ status: true });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].status).toBe(true);
      expect(result.summary).toEqual({ totalOrdersPending: 0, totalOrdersPaid: 1 });
      expect(mockOrderRepository.findAll).toHaveBeenCalledWith(
        {
          status: true,
          userId: undefined,
          tableId: undefined,
          paymentMethod: undefined,
          origin: undefined,
          dateFrom: undefined,
          dateTo: undefined,
        },
        { skip: 0, take: 20 }
      );
      expect(mockOrderRepository.count).toHaveBeenCalledWith({
        status: true,
        userId: undefined,
        tableId: undefined,
        paymentMethod: undefined,
        origin: undefined,
        dateFrom: undefined,
        dateTo: undefined,
      });
    });

    it('should return filtered orders by userId', async () => {
      const mockOrders = [
        new Order(
          'order-1',
          new Date(),
          false,
          1,
          23.20,
          20.00,
          3.20,
          false,
          null,
          0,
          'Local',
          null,
          false,
          null,
          'user-123',
          null, null, null, null, null, null, null, null,
          new Date(),
          new Date()
        ),
      ];

      mockOrderRepository.findAll.mockResolvedValue(mockOrders);
      stubOrderCounts(mockOrderRepository, 1, 0, 1);

      const result = await listOrdersUseCase.execute({ userId: 'user-123' });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].userId).toBe('user-123');
      expect(mockOrderRepository.findAll).toHaveBeenCalledWith(
        {
          status: undefined,
          userId: 'user-123',
          tableId: undefined,
          paymentMethod: undefined,
          origin: undefined,
          dateFrom: undefined,
          dateTo: undefined,
        },
        { skip: 0, take: 20 }
      );
    });

    it('should return filtered orders by tableId', async () => {
      const mockOrders = [
        new Order(
          'order-1',
          new Date(),
          false,
          1,
          23.20,
          20.00,
          3.20,
          false,
          'table-123',
          0,
          'Local',
          null,
          false,
          null,
          'user-123',
          null, null, null, null, null, null, null, null,
          new Date(),
          new Date()
        ),
      ];

      mockOrderRepository.findAll.mockResolvedValue(mockOrders);
      stubOrderCounts(mockOrderRepository, 1, 1, 0);

      const result = await listOrdersUseCase.execute({ tableId: 'table-123' });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].tableId).toBe('table-123');
      expect(mockOrderRepository.findAll).toHaveBeenCalledWith(
        {
          status: undefined,
          userId: undefined,
          tableId: 'table-123',
          paymentMethod: undefined,
          origin: undefined,
          dateFrom: undefined,
          dateTo: undefined,
        },
        { skip: 0, take: 20 }
      );
    });

    it('should return filtered orders by paymentMethod', async () => {
      const mockOrders = [
        new Order(
          'order-1',
          new Date(),
          false,
          2,
          23.20,
          20.00,
          3.20,
          false,
          null,
          0,
          'Local',
          null,
          false,
          null,
          'user-123',
          null, null, null, null, null, null, null, null,
          new Date(),
          new Date()
        ),
      ];

      mockOrderRepository.findAll.mockResolvedValue(mockOrders);
      stubOrderCounts(mockOrderRepository, 1, 1, 0);

      const result = await listOrdersUseCase.execute({ paymentMethod: 2 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].paymentMethod).toBe(2);
      expect(mockOrderRepository.findAll).toHaveBeenCalledWith(
        {
          status: undefined,
          userId: undefined,
          tableId: undefined,
          paymentMethod: 2,
          origin: undefined,
          dateFrom: undefined,
          dateTo: undefined,
        },
        { skip: 0, take: 20 }
      );
    });

    it('should return filtered orders by origin', async () => {
      const mockOrders = [
        new Order(
          'order-1',
          new Date(),
          false,
          1,
          23.20,
          20.00,
          3.20,
          false,
          null,
          0,
          'Delivery',
          null,
          false,
          null,
          'user-123',
          null, null, null, null, null, null, null, null,
          new Date(),
          new Date()
        ),
      ];

      mockOrderRepository.findAll.mockResolvedValue(mockOrders);
      stubOrderCounts(mockOrderRepository, 1, 0, 1);

      const result = await listOrdersUseCase.execute({ origin: 'Delivery' });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].origin).toBe('Delivery');
      expect(mockOrderRepository.findAll).toHaveBeenCalledWith(
        {
          status: undefined,
          userId: undefined,
          tableId: undefined,
          paymentMethod: undefined,
          origin: 'Delivery',
          dateFrom: undefined,
          dateTo: undefined,
        },
        { skip: 0, take: 20 }
      );
    });

    it('should return filtered orders by date range', async () => {
      const dateFrom = new Date('2024-01-01');
      const dateTo = new Date('2024-01-31');
      const mockOrders = [
        new Order(
          'order-1',
          new Date('2024-01-15'),
          false,
          1,
          23.20,
          20.00,
          3.20,
          false,
          null,
          0,
          'Local',
          null,
          false,
          null,
          'user-123',
          null, null, null, null, null, null, null, null,
          new Date(),
          new Date()
        ),
      ];

      mockOrderRepository.findAll.mockResolvedValue(mockOrders);
      stubOrderCounts(mockOrderRepository, 1, 1, 0);

      const result = await listOrdersUseCase.execute({
        dateFrom: dateFrom.toISOString(),
        dateTo: dateTo.toISOString(),
      });

      expect(result.data).toHaveLength(1);
      expect(mockOrderRepository.findAll).toHaveBeenCalledWith(
        {
          status: undefined,
          userId: undefined,
          tableId: undefined,
          paymentMethod: undefined,
          origin: undefined,
          dateFrom: dateFrom,
          dateTo: dateTo,
        },
        { skip: 0, take: 20 }
      );
    });

    it('should return empty data and pagination when no orders match filters', async () => {
      mockOrderRepository.findAll.mockResolvedValue([]);
      // Listado filtrado a pagadas: 0 coincidencias; resumen global en rango: 5 pendientes, 0 pagadas.
      stubOrderCounts(mockOrderRepository, 0, 5, 0);

      const result = await listOrdersUseCase.execute({ status: true });

      expect(result.data).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
      expect(result.pagination.totalPages).toBe(1);
      expect(result.summary).toEqual({ totalOrdersPending: 5, totalOrdersPaid: 0 });
    });

    it('should use page and limit for skip/take in DB', async () => {
      mockOrderRepository.findAll.mockResolvedValue([]);
      stubOrderCounts(mockOrderRepository, 50, 20, 30);

      const result = await listOrdersUseCase.execute({ page: 3, limit: 10 });

      const expectedFilters = {
        status: undefined,
        userId: undefined,
        tableId: undefined,
        paymentMethod: undefined,
        origin: undefined,
        dateFrom: undefined,
        dateTo: undefined,
      };
      expect(mockOrderRepository.findAll).toHaveBeenCalledWith(expectedFilters, { skip: 20, take: 10 });
      expect(mockOrderRepository.count).toHaveBeenCalledWith(expectedFilters);
      expect(result.pagination).toEqual({ page: 3, limit: 10, total: 50, totalPages: 5 });
      expect(result.summary).toEqual({ totalOrdersPending: 20, totalOrdersPaid: 30 });
    });
  });
});

