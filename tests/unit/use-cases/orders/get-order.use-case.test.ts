import { GetOrderUseCase } from '../../../../src/core/application/use-cases/orders/get-order.use-case';
import { IOrderRepository } from '../../../../src/core/domain/interfaces/order-repository.interface';
import { Order } from '../../../../src/core/domain/entities/order.entity';
import { OrderItem } from '../../../../src/core/domain/entities/order-item.entity';
import { OrderMenuItem } from '../../../../src/core/domain/entities/order-menu-item.entity';
import { AppError } from '../../../../src/shared/errors';

describe('GetOrderUseCase', () => {
  let getOrderUseCase: GetOrderUseCase;
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

    getOrderUseCase = new GetOrderUseCase(mockOrderRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    const validInput = {
      order_id: 'order-123',
    };

    it('should return order data with items when order exists', async () => {
      const mockOrder = new Order(
        'order-123',
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
      );

      const mockOrderItem = new OrderItem(
        'order-item-123',
        2,
        10.00,
        'order-123',
        'product-123',
        new Date(),
        new Date()
      );

      const mockOrderMenuItem = new OrderMenuItem(
        'order-menu-item-123',
        'order-123',
        'menu-item-123',
        1,
        10.50,
        null,
        new Date(),
        new Date()
      );

      mockOrderRepository.findById.mockResolvedValue(mockOrder);
      mockOrderRepository.findOrderItemsByOrderId.mockResolvedValue([mockOrderItem]);
      mockOrderRepository.findOrderMenuItemsByOrderId.mockResolvedValue([mockOrderMenuItem]);

      const result = await getOrderUseCase.execute(validInput);

      expect(result).toHaveProperty('id');
      expect(result.id).toBe('order-123');
      expect(result.status).toBe(false);
      expect(result.total).toBe(23.20);
      expect(result.orderItems).toHaveLength(1);
      expect(result.orderMenuItems).toHaveLength(1);
      expect(mockOrderRepository.findById).toHaveBeenCalledWith('order-123');
      expect(mockOrderRepository.findOrderItemsByOrderId).toHaveBeenCalledWith('order-123');
      expect(mockOrderRepository.findOrderMenuItemsByOrderId).toHaveBeenCalledWith('order-123');
    });

    it('should return order data without items when order has no items', async () => {
      const mockOrder = new Order(
        'order-123',
        new Date(),
        false,
        1,
        0,
        0,
        0,
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
      );

      mockOrderRepository.findById.mockResolvedValue(mockOrder);
      mockOrderRepository.findOrderItemsByOrderId.mockResolvedValue([]);
      mockOrderRepository.findOrderMenuItemsByOrderId.mockResolvedValue([]);

      const result = await getOrderUseCase.execute(validInput);

      expect(result).toHaveProperty('id');
      expect(result.id).toBe('order-123');
      expect(result.orderItems).toHaveLength(0);
      expect(result.orderMenuItems).toHaveLength(0);
    });

    it('should throw error when order not found', async () => {
      mockOrderRepository.findById.mockResolvedValue(null);

      try {
        await getOrderUseCase.execute(validInput);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('ORDER_NOT_FOUND');
      }
    });
  });
});

