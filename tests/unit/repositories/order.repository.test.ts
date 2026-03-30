/// <reference types="jest" />

import { OrderRepository } from '../../../src/core/infrastructure/database/repositories/order.repository';
import { Order } from '../../../src/core/domain/entities/order.entity';
import { OrderItem } from '../../../src/core/domain/entities/order-item.entity';

// Mock Prisma Client
const mockPrismaClient = {
  order: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  orderItem: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
};

describe('OrderRepository', () => {
  let repository: OrderRepository;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    repository = new OrderRepository(mockPrismaClient as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should return an order when found by id', async () => {
      const mockOrder = {
        id: 'order-123',
        date: new Date(),
        status: false,
        paymentMethod: 1,
        total: 23.20,
        subtotal: 20.00,
        iva: 3.20,
        delivered: false,
        tableId: null,
        tip: 0,
        origin: 'Local',
        client: null,
        paymentDiffer: false,
        note: null,
        userId: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaClient.order.findUnique.mockResolvedValue(mockOrder);

      const result = await repository.findById('order-123');

      expect(result).toBeInstanceOf(Order);
      expect(result?.id).toBe('order-123');
      expect(result?.status).toBe(false);
      expect(result?.total).toBe(23.20);
      expect(mockPrismaClient.order.findUnique).toHaveBeenCalledWith({
        where: { id: 'order-123' },
      });
    });

    it('should return null when order not found', async () => {
      mockPrismaClient.order.findUnique.mockResolvedValue(null);

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return all orders when no filters provided', async () => {
      const mockOrders = [
        {
          id: 'order-1',
          date: new Date(),
          status: false,
          paymentMethod: 1,
          total: 23.20,
          subtotal: 20.00,
          iva: 3.20,
          delivered: false,
          tableId: null,
          tip: 0,
          origin: 'Local',
          client: null,
          paymentDiffer: false,
          note: null,
          userId: 'user-123',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'order-2',
          date: new Date(),
          status: true,
          paymentMethod: 2,
          total: 50.00,
          subtotal: 43.10,
          iva: 6.90,
          delivered: false,
          tableId: 'table-123',
          tip: 0,
          origin: 'Delivery',
          client: 'John Doe',
          paymentDiffer: false,
          note: null,
          userId: 'user-456',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrismaClient.order.findMany.mockResolvedValue(mockOrders);

      const result = await repository.findAll();

      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(Order);
      expect(result[1]).toBeInstanceOf(Order);
      expect(result[0].id).toBe('order-1');
      expect(result[1].id).toBe('order-2');
    });

    it('should return filtered orders by status', async () => {
      const mockOrders = [
        {
          id: 'order-1',
          date: new Date(),
          status: true,
          paymentMethod: 1,
          total: 23.20,
          subtotal: 20.00,
          iva: 3.20,
          delivered: false,
          tableId: null,
          tip: 0,
          origin: 'Local',
          client: null,
          paymentDiffer: false,
          note: null,
          userId: 'user-123',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrismaClient.order.findMany.mockResolvedValue(mockOrders);

      const result = await repository.findAll({ status: true });

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe(true);
      expect(mockPrismaClient.order.findMany).toHaveBeenCalledWith({
        where: { status: true },
        orderBy: { date: 'desc' },
      });
    });

    it('should return filtered orders by date range', async () => {
      const dateFrom = new Date('2024-01-01');
      const dateTo = new Date('2024-01-31');
      const mockOrders: any[] = [];

      mockPrismaClient.order.findMany.mockResolvedValue(mockOrders);

      await repository.findAll({ dateFrom, dateTo });

      expect(mockPrismaClient.order.findMany).toHaveBeenCalledWith({
        where: {
          date: {
            gte: dateFrom,
            lte: dateTo,
          },
        },
        orderBy: { date: 'desc' },
      });
    });
  });

  describe('create', () => {
    it('should create a new order', async () => {
      const orderData = {
        status: false,
        paymentMethod: 1,
        total: 23.20,
        subtotal: 20.00,
        iva: 3.20,
        delivered: false,
        tableId: null,
        tip: 0,
        origin: 'Local',
        client: null,
        paymentDiffer: false,
        note: null,
        userId: 'user-123',
      };

      const mockCreatedOrder = {
        id: 'order-123',
        date: new Date(),
        ...orderData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaClient.order.create.mockResolvedValue(mockCreatedOrder);

      const result = await repository.create(orderData);

      expect(result).toBeInstanceOf(Order);
      expect(result.status).toBe(false);
      expect(result.total).toBe(23.20);
      expect(mockPrismaClient.order.create).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update order data', async () => {
      const updatedData = {
        status: true,
        delivered: true,
        tip: 5.00,
      };

      const mockUpdatedOrder = {
        id: 'order-123',
        date: new Date(),
        status: true,
        paymentMethod: 1,
        total: 23.20,
        subtotal: 20.00,
        iva: 3.20,
        delivered: true,
        tableId: null,
        tip: 5.00,
        origin: 'Local',
        client: null,
        paymentDiffer: false,
        note: null,
        userId: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaClient.order.update.mockResolvedValue(mockUpdatedOrder);

      const result = await repository.update('order-123', updatedData);

      expect(result).toBeInstanceOf(Order);
      expect(result.status).toBe(true);
      expect(result.delivered).toBe(true);
      expect(result.tip).toBe(5.00);
      expect(mockPrismaClient.order.update).toHaveBeenCalledWith({
        where: { id: 'order-123' },
        data: updatedData,
      });
    });
  });

  describe('delete', () => {
    it('should delete an order', async () => {
      mockPrismaClient.order.delete.mockResolvedValue({});

      await repository.delete('order-123');

      expect(mockPrismaClient.order.delete).toHaveBeenCalledWith({
        where: { id: 'order-123' },
      });
    });
  });

  describe('createOrderItem', () => {
    it('should create an order item', async () => {
      const orderItemData = {
        quantity: 2,
        price: 10.00,
        orderId: 'order-123',
        productId: 'product-123',
        menuItemId: null,
        note: null,
      };

      const mockCreatedOrderItem = {
        id: 'order-item-123',
        ...orderItemData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaClient.orderItem.create.mockResolvedValue(mockCreatedOrderItem);

      const result = await repository.createOrderItem(orderItemData);

      expect(result).toBeInstanceOf(OrderItem);
      expect(result.quantity).toBe(2);
      expect(result.price).toBe(10.00);
      expect(mockPrismaClient.orderItem.create).toHaveBeenCalled();
    });
  });

  describe('findOrderItemsByOrderId', () => {
    it('should return order items for an order', async () => {
      const mockOrderItems = [
        {
          id: 'order-item-1',
          quantity: 2,
          price: 10.00,
          orderId: 'order-123',
          productId: 'product-123',
          menuItemId: null,
          note: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'order-item-2',
          quantity: 1,
          price: 15.00,
          orderId: 'order-123',
          productId: 'product-456',
          menuItemId: null,
          note: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrismaClient.orderItem.findMany.mockResolvedValue(mockOrderItems);

      const result = await repository.findOrderItemsByOrderId('order-123');

      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(OrderItem);
      expect(result[1]).toBeInstanceOf(OrderItem);
      expect(mockPrismaClient.orderItem.findMany).toHaveBeenCalledWith({
        where: { orderId: 'order-123' },
      });
    });
  });
});
