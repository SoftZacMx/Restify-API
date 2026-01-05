import { ListOrdersUseCase } from '../../../../src/core/application/use-cases/orders/list-orders.use-case';
import { IOrderRepository } from '../../../../src/core/domain/interfaces/order-repository.interface';
import { Order } from '../../../../src/core/domain/entities/order.entity';

describe('ListOrdersUseCase', () => {
  let listOrdersUseCase: ListOrdersUseCase;
  let mockOrderRepository: jest.Mocked<IOrderRepository>;

  beforeEach(() => {
    mockOrderRepository = {
      findById: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      createOrderItem: jest.fn(),
      findOrderItemsByOrderId: jest.fn(),
      createOrderMenuItem: jest.fn(),
      findOrderMenuItemsByOrderId: jest.fn(),
    };

    listOrdersUseCase = new ListOrdersUseCase(mockOrderRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should return all orders when no filters provided', async () => {
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
          new Date(),
          new Date()
        ),
      ];

      mockOrderRepository.findAll.mockResolvedValue(mockOrders);

      const result = await listOrdersUseCase.execute();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('order-1');
      expect(result[1].id).toBe('order-2');
      expect(mockOrderRepository.findAll).toHaveBeenCalledWith(undefined);
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
          new Date(),
          new Date()
        ),
      ];

      mockOrderRepository.findAll.mockResolvedValue(mockOrders);

      const result = await listOrdersUseCase.execute({ status: true });

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe(true);
      expect(mockOrderRepository.findAll).toHaveBeenCalledWith({
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
          new Date(),
          new Date()
        ),
      ];

      mockOrderRepository.findAll.mockResolvedValue(mockOrders);

      const result = await listOrdersUseCase.execute({ userId: 'user-123' });

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe('user-123');
      expect(mockOrderRepository.findAll).toHaveBeenCalledWith({
        status: undefined,
        userId: 'user-123',
        tableId: undefined,
        paymentMethod: undefined,
        origin: undefined,
        dateFrom: undefined,
        dateTo: undefined,
      });
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
          new Date(),
          new Date()
        ),
      ];

      mockOrderRepository.findAll.mockResolvedValue(mockOrders);

      const result = await listOrdersUseCase.execute({ tableId: 'table-123' });

      expect(result).toHaveLength(1);
      expect(result[0].tableId).toBe('table-123');
      expect(mockOrderRepository.findAll).toHaveBeenCalledWith({
        status: undefined,
        userId: undefined,
        tableId: 'table-123',
        paymentMethod: undefined,
        origin: undefined,
        dateFrom: undefined,
        dateTo: undefined,
      });
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
          new Date(),
          new Date()
        ),
      ];

      mockOrderRepository.findAll.mockResolvedValue(mockOrders);

      const result = await listOrdersUseCase.execute({ paymentMethod: 2 });

      expect(result).toHaveLength(1);
      expect(result[0].paymentMethod).toBe(2);
      expect(mockOrderRepository.findAll).toHaveBeenCalledWith({
        status: undefined,
        userId: undefined,
        tableId: undefined,
        paymentMethod: 2,
        origin: undefined,
        dateFrom: undefined,
        dateTo: undefined,
      });
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
          new Date(),
          new Date()
        ),
      ];

      mockOrderRepository.findAll.mockResolvedValue(mockOrders);

      const result = await listOrdersUseCase.execute({ origin: 'Delivery' });

      expect(result).toHaveLength(1);
      expect(result[0].origin).toBe('Delivery');
      expect(mockOrderRepository.findAll).toHaveBeenCalledWith({
        status: undefined,
        userId: undefined,
        tableId: undefined,
        paymentMethod: undefined,
        origin: 'Delivery',
        dateFrom: undefined,
        dateTo: undefined,
      });
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
          new Date(),
          new Date()
        ),
      ];

      mockOrderRepository.findAll.mockResolvedValue(mockOrders);

      const result = await listOrdersUseCase.execute({
        dateFrom: dateFrom.toISOString(),
        dateTo: dateTo.toISOString(),
      });

      expect(result).toHaveLength(1);
      expect(mockOrderRepository.findAll).toHaveBeenCalledWith({
        status: undefined,
        userId: undefined,
        tableId: undefined,
        paymentMethod: undefined,
        origin: undefined,
        dateFrom: dateFrom,
        dateTo: dateTo,
      });
    });

    it('should return empty array when no orders match filters', async () => {
      mockOrderRepository.findAll.mockResolvedValue([]);

      const result = await listOrdersUseCase.execute({ status: true });

      expect(result).toHaveLength(0);
    });
  });
});

