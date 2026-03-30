import { UpdateOrderUseCase } from '../../../../src/core/application/use-cases/orders/update-order.use-case';
import { IOrderRepository } from '../../../../src/core/domain/interfaces/order-repository.interface';
import { ITableRepository } from '../../../../src/core/domain/interfaces/table-repository.interface';
import { IProductRepository } from '../../../../src/core/domain/interfaces/product-repository.interface';
import { IMenuItemRepository } from '../../../../src/core/domain/interfaces/menu-item-repository.interface';
import { QueueOrderNotificationUseCase } from '../../../../src/core/application/use-cases/websocket/queue-order-notification.use-case';
import { Order } from '../../../../src/core/domain/entities/order.entity';
import { OrderItem } from '../../../../src/core/domain/entities/order-item.entity';
import { Table } from '../../../../src/core/domain/entities/table.entity';
import { AppError } from '../../../../src/shared/errors';

describe('UpdateOrderUseCase', () => {
  let updateOrderUseCase: UpdateOrderUseCase;
  let mockOrderRepository: jest.Mocked<IOrderRepository>;
  let mockTableRepository: jest.Mocked<ITableRepository>;
  let mockProductRepository: jest.Mocked<IProductRepository>;
  let mockMenuItemRepository: jest.Mocked<IMenuItemRepository>;
  let mockQueueOrderNotificationUseCase: jest.Mocked<Pick<QueueOrderNotificationUseCase, 'execute'>>;

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
      findByName: jest.fn(),
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

    mockMenuItemRepository = {
      findById: jest.fn(),
      findByIds: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    mockQueueOrderNotificationUseCase = {
      execute: jest.fn().mockResolvedValue(undefined),
    };

    updateOrderUseCase = new UpdateOrderUseCase(
      mockOrderRepository,
      mockTableRepository,
      mockProductRepository,
      mockMenuItemRepository,
      mockQueueOrderNotificationUseCase as any
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    const orderId = 'order-123';

    const existingOrder = new Order(
      orderId,
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

    it('should update order status successfully', async () => {
      const updateInput = {
        status: true,
      };

      const updatedOrder = new Order(
        orderId,
        existingOrder.date,
        true,
        existingOrder.paymentMethod,
        existingOrder.total,
        existingOrder.subtotal,
        existingOrder.iva,
        existingOrder.delivered,
        existingOrder.tableId,
        existingOrder.tip,
        existingOrder.origin,
        existingOrder.client,
        existingOrder.paymentDiffer,
        existingOrder.note,
        existingOrder.userId,
        existingOrder.createdAt,
        new Date(),
      );

      mockOrderRepository.findById.mockResolvedValue(existingOrder);
      mockOrderRepository.update.mockResolvedValue(updatedOrder);
      mockOrderRepository.findOrderItemsByOrderId.mockResolvedValue([]);
      mockOrderRepository.findOrderItemExtrasByOrderId.mockResolvedValue([]);

      const result = await updateOrderUseCase.execute(orderId, updateInput);

      expect(result.status).toBe(true);
      expect(mockOrderRepository.findById).toHaveBeenCalledWith(orderId);
      expect(mockOrderRepository.update).toHaveBeenCalledWith(orderId, { status: true });
    });

    it('should update order with multiple fields', async () => {
      const updateInput = {
        status: true,
        delivered: true,
        tip: 5.00,
        note: 'Updated note',
      };

      const updatedOrder = new Order(
        orderId,
        existingOrder.date,
        true,
        existingOrder.paymentMethod,
        existingOrder.total,
        existingOrder.subtotal,
        existingOrder.iva,
        true,
        existingOrder.tableId,
        5.00,
        existingOrder.origin,
        existingOrder.client,
        existingOrder.paymentDiffer,
        'Updated note',
        existingOrder.userId,
        existingOrder.createdAt,
        new Date(),
      );

      mockOrderRepository.findById.mockResolvedValue(existingOrder);
      mockOrderRepository.update.mockResolvedValue(updatedOrder);
      mockOrderRepository.findOrderItemsByOrderId.mockResolvedValue([]);
      mockOrderRepository.findOrderItemExtrasByOrderId.mockResolvedValue([]);

      const result = await updateOrderUseCase.execute(orderId, updateInput);

      expect(result.status).toBe(true);
      expect(result.delivered).toBe(true);
      expect(result.tip).toBe(5.00);
      expect(result.note).toBe('Updated note');
      expect(mockOrderRepository.update).toHaveBeenCalledWith(orderId, updateInput);
    });

    it('should update order tableId and verify table exists', async () => {
      const updateInput = {
        tableId: 'table-123',
      };

      const mockTable = new Table(
        'table-123',
        'Mesa 1',
        'user-123',
        true,
        true,
        new Date(),
        new Date()
      );

      const updatedOrder = new Order(
        orderId,
        existingOrder.date,
        existingOrder.status,
        existingOrder.paymentMethod,
        existingOrder.total,
        existingOrder.subtotal,
        existingOrder.iva,
        existingOrder.delivered,
        'table-123',
        existingOrder.tip,
        existingOrder.origin,
        existingOrder.client,
        existingOrder.paymentDiffer,
        existingOrder.note,
        existingOrder.userId,
        existingOrder.createdAt,
        new Date(),
      );

      mockOrderRepository.findById.mockResolvedValue(existingOrder);
      mockTableRepository.findById.mockResolvedValue(mockTable);
      mockOrderRepository.update.mockResolvedValue(updatedOrder);
      mockOrderRepository.findOrderItemsByOrderId.mockResolvedValue([]);
      mockOrderRepository.findOrderItemExtrasByOrderId.mockResolvedValue([]);

      const result = await updateOrderUseCase.execute(orderId, updateInput);

      expect(result.tableId).toBe('table-123');
      expect(mockTableRepository.findById).toHaveBeenCalledWith('table-123');
    });

    it('should include order items and menu items in response', async () => {
      const updateInput = {
        status: true,
      };

      const updatedOrder = new Order(
        orderId,
        existingOrder.date,
        true,
        existingOrder.paymentMethod,
        existingOrder.total,
        existingOrder.subtotal,
        existingOrder.iva,
        existingOrder.delivered,
        existingOrder.tableId,
        existingOrder.tip,
        existingOrder.origin,
        existingOrder.client,
        existingOrder.paymentDiffer,
        existingOrder.note,
        existingOrder.userId,
        existingOrder.createdAt,
        new Date(),
      );

      const mockOrderItem = new OrderItem(
        'order-item-123', 2, 10.00, orderId, 'product-123', null, null, new Date(), new Date()
      );

      const mockMenuOrderItem = new OrderItem(
        'order-item-456', 1, 10.50, orderId, null, 'menu-item-123', null, new Date(), new Date()
      );

      mockOrderRepository.findById.mockResolvedValue(existingOrder);
      mockOrderRepository.update.mockResolvedValue(updatedOrder);
      mockOrderRepository.findOrderItemsByOrderId.mockResolvedValue([mockOrderItem, mockMenuOrderItem]);
      mockOrderRepository.findOrderItemExtrasByOrderId.mockResolvedValue([]);

      const result = await updateOrderUseCase.execute(orderId, updateInput);

      expect(result.orderItems).toHaveLength(2);
      expect(result.orderItems![0].id).toBe('order-item-123');
      expect(result.orderItems![1].id).toBe('order-item-456');
    });

    it('should throw error when order not found', async () => {
      const updateInput = {
        status: true,
      };

      mockOrderRepository.findById.mockResolvedValue(null);

      try {
        await updateOrderUseCase.execute(orderId, updateInput);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('ORDER_NOT_FOUND');
      }
    });

    it('should throw error when table not found', async () => {
      const updateInput = {
        tableId: 'table-123',
      };

      mockOrderRepository.findById.mockResolvedValue(existingOrder);
      mockTableRepository.findById.mockResolvedValue(null);

      try {
        await updateOrderUseCase.execute(orderId, updateInput);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('TABLE_NOT_FOUND');
      }
    });

    it('should allow setting tableId to null', async () => {
      const updateInput = {
        tableId: null,
      };

      const updatedOrder = new Order(
        orderId,
        existingOrder.date,
        existingOrder.status,
        existingOrder.paymentMethod,
        existingOrder.total,
        existingOrder.subtotal,
        existingOrder.iva,
        existingOrder.delivered,
        null,
        existingOrder.tip,
        existingOrder.origin,
        existingOrder.client,
        existingOrder.paymentDiffer,
        existingOrder.note,
        existingOrder.userId,
        existingOrder.createdAt,
        new Date(),
      );

      mockOrderRepository.findById.mockResolvedValue(existingOrder);
      mockOrderRepository.update.mockResolvedValue(updatedOrder);
      mockOrderRepository.findOrderItemsByOrderId.mockResolvedValue([]);
      mockOrderRepository.findOrderItemExtrasByOrderId.mockResolvedValue([]);

      const result = await updateOrderUseCase.execute(orderId, updateInput);

      expect(result.tableId).toBeNull();
      expect(mockTableRepository.findById).not.toHaveBeenCalled();
    });

    it('should allow setting paymentMethod to null for split payments', async () => {
      const updateInput = {
        paymentMethod: null,
        paymentDiffer: true,
      };

      const updatedOrder = new Order(
        orderId,
        existingOrder.date,
        existingOrder.status,
        null, // paymentMethod can be null for split payments
        existingOrder.total,
        existingOrder.subtotal,
        existingOrder.iva,
        existingOrder.delivered,
        existingOrder.tableId,
        existingOrder.tip,
        existingOrder.origin,
        existingOrder.client,
        true, // paymentDiffer
        existingOrder.note,
        existingOrder.userId,
        existingOrder.createdAt,
        new Date(),
      );

      mockOrderRepository.findById.mockResolvedValue(existingOrder);
      mockOrderRepository.update.mockResolvedValue(updatedOrder);
      mockOrderRepository.findOrderItemsByOrderId.mockResolvedValue([]);
      mockOrderRepository.findOrderItemExtrasByOrderId.mockResolvedValue([]);

      const result = await updateOrderUseCase.execute(orderId, updateInput);

      expect(result.paymentMethod).toBeNull();
      expect(result.paymentDiffer).toBe(true);
      expect(mockOrderRepository.update).toHaveBeenCalledWith(orderId, updateInput);
    });
  });
});
