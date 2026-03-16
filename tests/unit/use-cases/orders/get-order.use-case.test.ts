import { GetOrderUseCase } from '../../../../src/core/application/use-cases/orders/get-order.use-case';
import { IOrderRepository } from '../../../../src/core/domain/interfaces/order-repository.interface';
import { ITableRepository } from '../../../../src/core/domain/interfaces/table-repository.interface';
import { IMenuItemRepository } from '../../../../src/core/domain/interfaces/menu-item-repository.interface';
import { IProductRepository } from '../../../../src/core/domain/interfaces/product-repository.interface';
import { Order } from '../../../../src/core/domain/entities/order.entity';
import { OrderItem } from '../../../../src/core/domain/entities/order-item.entity';
import { OrderItemExtra } from '../../../../src/core/domain/entities/order-item-extra.entity';
import { MenuItem } from '../../../../src/core/domain/entities/menu-item.entity';
import { Product } from '../../../../src/core/domain/entities/product.entity';
import { AppError } from '../../../../src/shared/errors';

describe('GetOrderUseCase', () => {
  let getOrderUseCase: GetOrderUseCase;
  let mockOrderRepository: jest.Mocked<IOrderRepository>;
  let mockTableRepository: jest.Mocked<ITableRepository>;
  let mockMenuItemRepository: jest.Mocked<IMenuItemRepository>;
  let mockProductRepository: jest.Mocked<IProductRepository>;

  beforeEach(() => {
    mockOrderRepository = {
      findById: jest.fn(),
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
    mockTableRepository = {
      findById: jest.fn(),
      findByNumberTable: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    mockMenuItemRepository = {
      findById: jest.fn(),
      findByIds: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    mockProductRepository = {
      findById: jest.fn(),
      findByIds: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    getOrderUseCase = new GetOrderUseCase(
      mockOrderRepository,
      mockTableRepository,
      mockMenuItemRepository,
      mockProductRepository
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    const validInput = {
      order_id: 'order-123',
    };

    it('should return order data with items and names when order exists', async () => {
      const mockOrder = new Order(
        'order-123',
        new Date(),
        false,
        1,
        23.2,
        20.0,
        3.2,
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
        10,
        'order-123',
        null,
        'menu-item-123',
        null,
        new Date(),
        new Date()
      );

      const mockExtra = new OrderItemExtra(
        'extra-1',
        'order-123',
        'order-item-123',
        'extra-menu-id',
        1,
        2.5,
        new Date(),
        new Date()
      );

      const mockMenuItem = new MenuItem(
        'menu-item-123',
        'Platillo principal',
        10,
        true,
        false,
        null,
        'user-123',
        new Date(),
        new Date()
      );

      const mockExtraMenuItem = new MenuItem(
        'extra-menu-id',
        'Queso extra',
        2.5,
        true,
        true,
        null,
        'user-123',
        new Date(),
        new Date()
      );

      mockOrderRepository.findById.mockResolvedValue(mockOrder);
      mockOrderRepository.findOrderItemsByOrderId.mockResolvedValue([mockOrderItem]);
      mockOrderRepository.findOrderItemExtrasByOrderId.mockResolvedValue([mockExtra]);
      mockMenuItemRepository.findByIds.mockResolvedValue([mockMenuItem, mockExtraMenuItem]);
      mockProductRepository.findByIds.mockResolvedValue([]);

      const result = await getOrderUseCase.execute(validInput);

      expect(result).toHaveProperty('id');
      expect(result.id).toBe('order-123');
      expect(result.status).toBe(false);
      expect(result.total).toBe(23.2);
      expect(result.orderItems).toHaveLength(1);
      expect(result.orderItems![0].menuItem).toEqual({ id: 'menu-item-123', name: 'Platillo principal' });
      expect(result.orderItems![0].extras).toHaveLength(1);
      expect(result.orderItems![0].extras![0].extra).toEqual({ id: 'extra-menu-id', name: 'Queso extra' });
      expect(mockOrderRepository.findById).toHaveBeenCalledWith('order-123');
      expect(mockOrderRepository.findOrderItemsByOrderId).toHaveBeenCalledWith('order-123');
      expect(mockOrderRepository.findOrderItemExtrasByOrderId).toHaveBeenCalledWith('order-123');
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
      mockOrderRepository.findOrderItemExtrasByOrderId.mockResolvedValue([]);

      const result = await getOrderUseCase.execute(validInput);

      expect(result).toHaveProperty('id');
      expect(result.id).toBe('order-123');
      expect(result.orderItems).toHaveLength(0);
      expect(mockMenuItemRepository.findByIds).toHaveBeenCalledWith([]);
      expect(mockProductRepository.findByIds).toHaveBeenCalledWith([]);
    });

    it('should throw error when order not found', async () => {
      mockOrderRepository.findById.mockResolvedValue(null);

      await expect(getOrderUseCase.execute(validInput)).rejects.toThrow(AppError);
      await expect(getOrderUseCase.execute(validInput)).rejects.toMatchObject({
        code: 'ORDER_NOT_FOUND',
      });
    });
  });
});
