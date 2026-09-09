import { UpdateOrderUseCase } from '../../../../src/core/application/use-cases/orders/update-order.use-case';
import { IOrderRepository } from '../../../../src/core/domain/interfaces/order-repository.interface';
import { ITableRepository } from '../../../../src/core/domain/interfaces/table-repository.interface';
import { Order } from '../../../../src/core/domain/entities/order.entity';
import { OrderItem } from '../../../../src/core/domain/entities/order-item.entity';
import { Table } from '../../../../src/core/domain/entities/table.entity';
import { StockService } from '../../../../src/core/application/services/stock.service';
import { getPrisma } from '../../../../src/core/infrastructure/database/prisma/get-prisma';
import { AppError } from '../../../../src/shared/errors';

jest.mock('../../../../src/core/infrastructure/database/prisma/get-prisma');
const mockGetPrisma = getPrisma as jest.MockedFunction<typeof getPrisma>;

describe('UpdateOrderUseCase', () => {
  let updateOrderUseCase: UpdateOrderUseCase;
  let mockOrderRepository: jest.Mocked<IOrderRepository>;
  let mockTableRepository: jest.Mocked<ITableRepository>;
  let mockStockService: any;
  let mockTx: any;
  let mockPrismaClient: any;

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

    mockTableRepository = {
      findById: jest.fn(),
      findByName: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    mockStockService = {
      recordSaleForOrderItem: jest.fn().mockResolvedValue([]),
      reverseSaleForOrderItem: jest.fn().mockResolvedValue([]),
      recordSalesBatch: jest.fn().mockResolvedValue(undefined),
      reverseSalesBatch: jest.fn().mockResolvedValue(undefined),
    };

    mockTx = {
      orderItem: {
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        deleteMany: jest.fn().mockResolvedValue({}),
      },
      orderItemExtra: {
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        deleteMany: jest.fn().mockResolvedValue({}),
      },
      stockMovement: {
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      product: {
        update: jest.fn().mockResolvedValue({}),
      },
    };

    mockPrismaClient = {
      $transaction: jest.fn().mockImplementation((cb: Function) => cb(mockTx)),
      menuItem: { findMany: jest.fn().mockResolvedValue([]) },
      product: { findMany: jest.fn().mockResolvedValue([]) },
    };

    mockGetPrisma.mockReturnValue(mockPrismaClient);

    updateOrderUseCase = new UpdateOrderUseCase(
      mockOrderRepository,
      mockTableRepository,
      mockStockService as unknown as StockService,
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
      null, null, null, null, null, null, null, null, null,
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
        null, null, null, null, null, null, null, null, null,
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
        null, null, null, null, null, null, null, null, null,
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
        null, null, null, null, null, null, null, null, null,
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
        null, null, null, null, null, null, null, null, null,
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
        null, null, null, null, null, null, null, null, null,
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
        null, null, null, null, null, null, null, null, null,
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

  describe('execute with orderItems', () => {
    const orderId = 'order-123';

    function makeOrder(overrides: Partial<Record<string, unknown>> = {}): Order {
      return new Order(
        orderId,
        new Date(),
        (overrides.status as boolean) ?? false,
        (overrides.paymentMethod as number) ?? 1,
        (overrides.total as number) ?? 23.2,
        (overrides.subtotal as number) ?? 20,
        (overrides.iva as number) ?? 3.2,
        (overrides.delivered as boolean) ?? false,
        (overrides.tableId as string) ?? null,
        (overrides.tip as number) ?? 0,
        (overrides.origin as string) ?? 'Local',
        (overrides.client as string) ?? null,
        (overrides.paymentDiffer as boolean) ?? false,
        (overrides.note as string) ?? null,
        'user-123',
        null, null, null, null, null, null, null, null, null,
        new Date(),
        new Date()
      );
    }

    it('rechaza modificar los items de una orden pagada', async () => {
      mockOrderRepository.findById.mockResolvedValue(makeOrder({ status: true }));

      await expect(
        updateOrderUseCase.execute(orderId, {
          orderItems: [{ quantity: 1, price: 5, extras: [] }],
        })
      ).rejects.toMatchObject({ code: 'ORDER_ALREADY_PAID' });

      expect(mockPrismaClient.$transaction).not.toHaveBeenCalled();
    });

    it('lanza PRODUCT_NOT_FOUND si un item directo no existe', async () => {
      mockOrderRepository.findById.mockResolvedValue(makeOrder());
      mockPrismaClient.product.findMany.mockResolvedValue([]);

      await expect(
        updateOrderUseCase.execute(orderId, {
          orderItems: [{ quantity: 1, price: 5, productId: 'missing', extras: [] }],
        })
      ).rejects.toMatchObject({ code: 'PRODUCT_NOT_FOUND' });
    });

    it('lanza MENU_ITEM_NOT_FOUND si un menu item no existe', async () => {
      mockOrderRepository.findById.mockResolvedValue(makeOrder());
      mockPrismaClient.menuItem.findMany.mockResolvedValue([]);

      await expect(
        updateOrderUseCase.execute(orderId, {
          orderItems: [{ quantity: 1, price: 5, menuItemId: 'mi-missing', extras: [] }],
        })
      ).rejects.toMatchObject({ code: 'MENU_ITEM_NOT_FOUND' });
    });

    it('lanza INVALID_MENU_ITEM si el item es un extra', async () => {
      mockOrderRepository.findById.mockResolvedValue(makeOrder());
      mockPrismaClient.menuItem.findMany.mockResolvedValue([
        { id: 'mi-extra', productId: null, isExtra: true, ingredients: [] },
      ]);

      await expect(
        updateOrderUseCase.execute(orderId, {
          orderItems: [{ quantity: 1, price: 5, menuItemId: 'mi-extra', extras: [] }],
        })
      ).rejects.toMatchObject({ code: 'INVALID_MENU_ITEM' });
    });

    it('lanza MENU_ITEM_NOT_FOUND si un extra no existe', async () => {
      mockOrderRepository.findById.mockResolvedValue(makeOrder());
      mockPrismaClient.menuItem.findMany.mockResolvedValue([]);

      await expect(
        updateOrderUseCase.execute(orderId, {
          orderItems: [
            {
              quantity: 1,
              price: 5,
              menuItemId: null,
              extras: [{ extraId: 'ex-missing', quantity: 1, price: 2 }],
            },
          ],
        })
      ).rejects.toMatchObject({ code: 'MENU_ITEM_NOT_FOUND' });
    });

    it('lanza INVALID_EXTRA si un extra no es un extra', async () => {
      mockOrderRepository.findById.mockResolvedValue(makeOrder());
      mockPrismaClient.menuItem.findMany.mockResolvedValue([
        { id: 'ex-not-extra', productId: null, isExtra: false, ingredients: [] },
      ]);

      await expect(
        updateOrderUseCase.execute(orderId, {
          orderItems: [
            {
              quantity: 1,
              price: 5,
              menuItemId: null,
              extras: [{ extraId: 'ex-not-extra', quantity: 1, price: 2 }],
            },
          ],
        })
      ).rejects.toMatchObject({ code: 'INVALID_EXTRA' });
    });

    it('reemplaza items y ajusta stock con estrategia reversal + resale (transacción)', async () => {
      mockOrderRepository.findById.mockResolvedValue(makeOrder());
      mockPrismaClient.product.findMany.mockResolvedValue([
        { id: 'prod-1', unitOfMeasure: null, trackStock: true, stockActual: null, branchId: 'b1' },
        { id: 'prod-mi', unitOfMeasure: null, trackStock: true, stockActual: null, branchId: 'b1' },
        { id: 'ing-1', unitOfMeasure: null, trackStock: true, stockActual: null, branchId: 'b1' },
        { id: 'ing-2', unitOfMeasure: null, trackStock: true, stockActual: null, branchId: 'b1' },
      ]);
      mockPrismaClient.menuItem.findMany.mockResolvedValue([
        {
          id: 'mi-1',
          productId: 'prod-mi',
          isExtra: false,
          ingredients: [{ productId: 'ing-1', quantity: 1, unit: null }],
        },
        {
          id: 'ex-1',
          productId: null,
          isExtra: true,
          ingredients: [{ productId: 'ing-2', quantity: 2, unit: null }],
        },
      ]);
      mockTx.orderItem.findMany.mockResolvedValue([{ id: 'old-item-1' }, { id: 'old-item-2' }]);

      const updatedOrder = makeOrder({ subtotal: 23, total: 23 });
      mockOrderRepository.update.mockResolvedValue(updatedOrder);
      mockOrderRepository.findOrderItemsByOrderId.mockResolvedValue([]);
      mockOrderRepository.findOrderItemExtrasByOrderId.mockResolvedValue([]);

      const result = await updateOrderUseCase.execute(
        orderId,
        {
          orderItems: [
            { quantity: 2, price: 5, productId: 'prod-1', menuItemId: null, note: null, extras: [] },
            {
              quantity: 1,
              price: 10,
              productId: null,
              menuItemId: 'mi-1',
              note: null,
              extras: [{ extraId: 'ex-1', quantity: 1, price: 3 }],
            },
          ],
          tip: 5,
        },
        'actor-user'
      );

      expect(mockStockService.reverseSalesBatch).toHaveBeenCalledWith(
        ['old-item-1', 'old-item-2'],
        'actor-user',
        'order edited',
        mockTx
      );
      expect(mockTx.orderItem.deleteMany).toHaveBeenCalledWith({ where: { orderId } });
      expect(mockTx.orderItem.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ productId: 'prod-1', quantity: 2, price: 5 }),
          expect.objectContaining({ menuItemId: 'mi-1', quantity: 1, price: 10 }),
        ]),
      });
      expect(mockTx.orderItemExtra.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([expect.objectContaining({ extraId: 'ex-1', quantity: 1, price: 3 })]),
      });

      const saleBatch = mockStockService.recordSalesBatch.mock.calls[0][0];
      expect(saleBatch).toHaveLength(2);
      expect(saleBatch[0]).toMatchObject({ orderItemId: expect.any(String), productId: 'prod-1' });
      expect(saleBatch[1]).toMatchObject({
        menuItem: { productId: 'prod-mi', ingredients: [{ productId: 'ing-1', quantity: 1 }] },
        extras: [
          {
            quantity: 1,
            menuItem: { productId: null, ingredients: [{ productId: 'ing-2', quantity: 2 }] },
          },
        ],
      });
      expect(mockStockService.recordSalesBatch).toHaveBeenCalledWith(
        saleBatch,
        expect.any(Map),
        'actor-user',
        mockTx
      );

      // subtotal = 2*5 + 1*10 + 1*3 = 23; total = subtotal + tip (5) = 28
      expect(mockOrderRepository.update).toHaveBeenCalledWith(orderId, {
        tip: 5,
        subtotal: 23,
        iva: 0,
        total: 28,
      });
      expect(result).toBeDefined();
    });

    it('actualiza origin, client y paymentMethod', async () => {
      mockOrderRepository.findById.mockResolvedValue(makeOrder());
      const updatedOrder = makeOrder({ origin: 'Delivery', client: 'Ana', paymentMethod: 2 });
      mockOrderRepository.update.mockResolvedValue(updatedOrder);
      mockOrderRepository.findOrderItemsByOrderId.mockResolvedValue([]);
      mockOrderRepository.findOrderItemExtrasByOrderId.mockResolvedValue([]);

      const result = await updateOrderUseCase.execute(orderId, {
        origin: 'Delivery',
        client: 'Ana',
        paymentMethod: 2,
      });

      expect(result.origin).toBe('Delivery');
      expect(result.client).toBe('Ana');
      expect(result.paymentMethod).toBe(2);
    });

    it('tolera items sin extras en la entrada (defensivo)', async () => {
      mockOrderRepository.findById.mockResolvedValue(makeOrder());
      mockPrismaClient.product.findMany.mockResolvedValue([
        { id: 'prod-1', unitOfMeasure: null, trackStock: true, stockActual: null, branchId: 'b1' },
      ]);

      const updatedOrder = makeOrder({ subtotal: 5, total: 5 });
      mockOrderRepository.update.mockResolvedValue(updatedOrder);
      mockOrderRepository.findOrderItemsByOrderId.mockResolvedValue([]);
      mockOrderRepository.findOrderItemExtrasByOrderId.mockResolvedValue([]);

      await updateOrderUseCase.execute(
        orderId,
        { orderItems: [{ quantity: 1, price: 5, productId: 'prod-1', menuItemId: null }] as any },
        'actor-user'
      );

      expect(mockOrderRepository.update).toHaveBeenCalledWith(orderId, {
        subtotal: 5,
        iva: 0,
        total: 5,
      });
      expect(mockTx.orderItemExtra.createMany).not.toHaveBeenCalled();
    });

    it('libera la mesa cuando la orden queda como entregada y es Local', async () => {
      const orderWithTable = makeOrder({ tableId: 'table-1' });
      mockOrderRepository.findById.mockResolvedValue(orderWithTable);
      mockTableRepository.findById.mockResolvedValue(new Table('table-1', 'Mesa 1', 'user', true, true, new Date(), new Date()));

      const deliveredOrder = makeOrder({
        tableId: 'table-1',
        delivered: true,
        origin: 'Local',
      });
      mockOrderRepository.update.mockResolvedValue(deliveredOrder);
      mockOrderRepository.findOrderItemsByOrderId.mockResolvedValue([]);
      mockOrderRepository.findOrderItemExtrasByOrderId.mockResolvedValue([]);

      await updateOrderUseCase.execute(orderId, { delivered: true, tableId: 'table-1' });

      expect(mockTableRepository.update).toHaveBeenCalledWith('table-1', { availabilityStatus: true });
    });

    it('NO libera la mesa si la orden entregada no es Local', async () => {
      const orderWithTable = makeOrder({ tableId: 'table-1' });
      mockOrderRepository.findById.mockResolvedValue(orderWithTable);
      mockTableRepository.findById.mockResolvedValue(new Table('table-1', 'Mesa 1', 'user', true, true, new Date(), new Date()));

      const deliveredOrder = makeOrder({
        tableId: 'table-1',
        delivered: true,
        origin: 'Delivery',
      });
      mockOrderRepository.update.mockResolvedValue(deliveredOrder);
      mockOrderRepository.findOrderItemsByOrderId.mockResolvedValue([]);
      mockOrderRepository.findOrderItemExtrasByOrderId.mockResolvedValue([]);

      await updateOrderUseCase.execute(orderId, { delivered: true, tableId: 'table-1' });

      expect(mockTableRepository.update).not.toHaveBeenCalled();
    });

    it('agrupa los extras por orderItem en la respuesta', async () => {
      mockOrderRepository.findById.mockResolvedValue(makeOrder());
      mockOrderRepository.update.mockResolvedValue(makeOrder());
      mockOrderRepository.findOrderItemsByOrderId.mockResolvedValue([
        new OrderItem('oi-1', 2, 10, orderId, null, null, null, new Date(), new Date()),
      ]);
      mockOrderRepository.findOrderItemExtrasByOrderId.mockResolvedValue([
        {
          id: 'extra-1',
          orderId,
          orderItemId: 'oi-1',
          extraId: 'ex-1',
          quantity: 1,
          price: 3,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await updateOrderUseCase.execute(orderId, { status: false });

      expect(result.orderItems).toHaveLength(1);
      expect(result.orderItems![0].extras).toEqual([
        expect.objectContaining({ extraId: 'ex-1', quantity: 1, price: 3 }),
      ]);
    });
  });
});
