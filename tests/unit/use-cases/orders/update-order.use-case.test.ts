import { UpdateOrderUseCase } from '../../../../src/core/application/use-cases/orders/update-order.use-case';
import { IOrderRepository } from '../../../../src/core/domain/interfaces/order-repository.interface';
import { ITableRepository } from '../../../../src/core/domain/interfaces/table-repository.interface';
import { Order } from '../../../../src/core/domain/entities/order.entity';
import { OrderItem } from '../../../../src/core/domain/entities/order-item.entity';
import { OrderMenuItem } from '../../../../src/core/domain/entities/order-menu-item.entity';
import { Table } from '../../../../src/core/domain/entities/table.entity';
import { AppError } from '../../../../src/shared/errors';

describe('UpdateOrderUseCase', () => {
  let updateOrderUseCase: UpdateOrderUseCase;
  let mockOrderRepository: jest.Mocked<IOrderRepository>;
  let mockTableRepository: jest.Mocked<ITableRepository>;

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

    mockTableRepository = {
      findById: jest.fn(),
      findByName: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    updateOrderUseCase = new UpdateOrderUseCase(mockOrderRepository, mockTableRepository);
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
      mockOrderRepository.findOrderMenuItemsByOrderId.mockResolvedValue([]);

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
      mockOrderRepository.findOrderMenuItemsByOrderId.mockResolvedValue([]);

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
        1,
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
      mockOrderRepository.findOrderMenuItemsByOrderId.mockResolvedValue([]);

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
        'order-item-123',
        2,
        10.00,
        orderId,
        'product-123',
        new Date(),
        new Date()
      );

      const mockOrderMenuItem = new OrderMenuItem(
        'order-menu-item-123',
        orderId,
        'menu-item-123',
        1,
        10.50,
        null,
        new Date(),
        new Date()
      );

      mockOrderRepository.findById.mockResolvedValue(existingOrder);
      mockOrderRepository.update.mockResolvedValue(updatedOrder);
      mockOrderRepository.findOrderItemsByOrderId.mockResolvedValue([mockOrderItem]);
      mockOrderRepository.findOrderMenuItemsByOrderId.mockResolvedValue([mockOrderMenuItem]);

      const result = await updateOrderUseCase.execute(orderId, updateInput);

      expect(result.orderItems).toHaveLength(1);
      expect(result.orderMenuItems).toHaveLength(1);
      expect(result.orderItems![0].id).toBe('order-item-123');
      expect(result.orderMenuItems![0].id).toBe('order-menu-item-123');
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
      mockOrderRepository.findOrderMenuItemsByOrderId.mockResolvedValue([]);

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
      mockOrderRepository.findOrderMenuItemsByOrderId.mockResolvedValue([]);

      const result = await updateOrderUseCase.execute(orderId, updateInput);

      expect(result.paymentMethod).toBeNull();
      expect(result.paymentDiffer).toBe(true);
      expect(mockOrderRepository.update).toHaveBeenCalledWith(orderId, updateInput);
    });
  });
});

