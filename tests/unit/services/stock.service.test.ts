import { Prisma, StockMovementType } from '@prisma/client';
import { StockService } from '../../../src/core/application/services/stock.service';
import { PrismaService } from '../../../src/core/infrastructure/config/prisma.config';
import { getPrisma } from '../../../src/core/infrastructure/database/prisma/get-prisma';
import { AppError } from '../../../src/shared/errors';

const Decimal = Prisma.Decimal;

jest.mock('../../../src/core/infrastructure/database/prisma/get-prisma');

const mockGetPrisma = getPrisma as jest.MockedFunction<typeof getPrisma>;

function product(overrides: Partial<Record<string, unknown>> = {}): any {
  return {
    id: 'prod-1',
    name: 'Harina',
    description: null,
    unitOfMeasure: 'KG',
    stockActual: new Decimal(10),
    averageCost: new Decimal(5),
    minStockAlert: null,
    trackStock: true,
    branchId: 'branch-1',
    ...overrides,
  };
}

function movement(overrides: Partial<Record<string, unknown>> = {}): any {
  return {
    id: 'mov-id',
    productId: 'prod-1',
    quantity: new Decimal(5),
    type: StockMovementType.PURCHASE,
    reason: null,
    notes: null,
    userId: 'user-1',
    expenseItemId: null,
    orderItemId: null,
    branchId: 'branch-1',
    ...overrides,
  };
}

/**
 * Construye un mock de PrismaService cuyo `$transaction` ejecuta el callback con un mockTx.
 */
function createMockPrismaService() {
  const mockTx = {
    product: {
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
    },
    stockMovement: {
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'mov-id', ...data })),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    orderItem: {
      findUnique: jest.fn(),
    },
  };

  const client = {
    $transaction: jest.fn().mockImplementation((cb: Function) => cb(mockTx)),
  };

  const prismaService = {
    getClient: jest.fn().mockReturnValue(client),
  } as unknown as PrismaService;

  return { prismaService, mockTx, client };
}

describe('StockService', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockGetPrisma.mockClear();
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  describe('recordPurchase', () => {
    it('recalcula averageCost con la fórmula ponderada y suma stock cuando trackStock=true', async () => {
      const { prismaService, mockTx } = createMockPrismaService();
      const service = new StockService(prismaService);

      mockTx.product.findUnique.mockResolvedValue(product());

      const m = await service.recordPurchase({
        productId: 'prod-1',
        quantity: 5,
        unitCost: 7,
        userId: 'user-1',
        expenseItemId: 'ei-1',
      });

      expect(m).not.toBeNull();
      expect(mockTx.stockMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          productId: 'prod-1',
          type: StockMovementType.PURCHASE,
          expenseItemId: 'ei-1',
          userId: 'user-1',
        }),
      });
      const updateCall = mockTx.product.update.mock.calls[0][0];
      expect(updateCall.data.stockActual.toString()).toBe('15');
      expect(parseFloat(updateCall.data.averageCost.toString())).toBeCloseTo(5.6667, 3);
    });

    it('convierte unidades compatibles (G → KG) preservando el total', async () => {
      const { prismaService, mockTx } = createMockPrismaService();
      const service = new StockService(prismaService);

      mockTx.product.findUnique.mockResolvedValue(product());

      // Comprar 100 G a $0.50/G → total $50 → almacenar 0.1 KG a $500/KG
      const m = await service.recordPurchase({
        productId: 'prod-1',
        quantity: 100,
        unitCost: 0.5,
        unitOfMeasure: 'G',
        userId: 'user-1',
      });

      const createdData = mockTx.stockMovement.create.mock.calls[0][0].data;
      expect(createdData.quantity.toString()).toBe('0.1');
      expect(m).not.toBeNull();

      const updateCall = mockTx.product.update.mock.calls[0][0];
      expect(updateCall.data.stockActual.toString()).toBe('10.1');
      // (10*5 + 0.1*500) / 10.1 = 100/10.1
      expect(parseFloat(updateCall.data.averageCost.toString())).toBeCloseTo(9.901, 3);
    });

    it('lanza INCOMPATIBLE_UNIT si la unidad no es compatible con la del producto', async () => {
      const { prismaService, mockTx } = createMockPrismaService();
      const service = new StockService(prismaService);

      mockTx.product.findUnique.mockResolvedValue(product({ unitOfMeasure: 'PCS' }));

      await expect(
        service.recordPurchase({
          productId: 'prod-1',
          quantity: 100,
          unitCost: 0.5,
          unitOfMeasure: 'G',
          userId: 'user-1',
        })
      ).rejects.toMatchObject({ code: 'INCOMPATIBLE_UNIT' });
    });

    it('actualiza averageCost pero NO crea movement ni mueve stock cuando trackStock=false', async () => {
      const { prismaService, mockTx } = createMockPrismaService();
      const service = new StockService(prismaService);

      mockTx.product.findUnique.mockResolvedValue(product({ trackStock: false, stockActual: new Decimal(0), averageCost: new Decimal(0) }));

      const m = await service.recordPurchase({
        productId: 'prod-1',
        quantity: 10,
        unitCost: 8,
        userId: 'user-1',
      });

      expect(m).toBeNull();
      expect(mockTx.stockMovement.create).not.toHaveBeenCalled();
      const updateCall = mockTx.product.update.mock.calls[0][0];
      expect(updateCall.data).toEqual({ averageCost: expect.anything() });
      expect(updateCall.data.stockActual).toBeUndefined();
      expect(parseFloat(updateCall.data.averageCost.toString())).toBe(8);
    });

    it('cuando stock previo + comprado = 0 usa unitCost directo (caso borde)', async () => {
      const { prismaService, mockTx } = createMockPrismaService();
      const service = new StockService(prismaService);

      mockTx.product.findUnique.mockResolvedValue(product({ stockActual: new Decimal(0), averageCost: new Decimal(0) }));

      await service.recordPurchase({
        productId: 'prod-1',
        quantity: 10,
        unitCost: 8,
        userId: 'user-1',
      });

      const updateCall = mockTx.product.update.mock.calls[0][0];
      expect(parseFloat(updateCall.data.averageCost.toString())).toBe(8);
    });

    it('rechaza quantity <= 0', async () => {
      const { prismaService } = createMockPrismaService();
      const service = new StockService(prismaService);

      await expect(
        service.recordPurchase({ productId: 'p', quantity: 0, unitCost: 5, userId: 'u' })
      ).rejects.toMatchObject({ code: 'STOCK_INVALID_QUANTITY' });
    });

    it('rechaza unitCost negativo', async () => {
      const { prismaService } = createMockPrismaService();
      const service = new StockService(prismaService);

      await expect(
        service.recordPurchase({ productId: 'p', quantity: 1, unitCost: -1, userId: 'u' })
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('cuando recibe tx externa, NO abre $transaction propio', async () => {
      const { prismaService, client, mockTx } = createMockPrismaService();
      const service = new StockService(prismaService);

      mockTx.product.findUnique.mockResolvedValue(product());

      await service.recordPurchase(
        { productId: 'prod-1', quantity: 1, unitCost: 5, userId: 'u' },
        mockTx as any
      );

      expect(client.$transaction).not.toHaveBeenCalled();
      expect(mockTx.stockMovement.create).toHaveBeenCalled();
    });

    it('lanza PRODUCT_NOT_FOUND si el producto no existe', async () => {
      const { prismaService, mockTx } = createMockPrismaService();
      const service = new StockService(prismaService);

      mockTx.product.findUnique.mockResolvedValue(null);

      await expect(
        service.recordPurchase({ productId: 'missing', quantity: 1, unitCost: 5, userId: 'u' })
      ).rejects.toMatchObject({ code: 'PRODUCT_NOT_FOUND' });
    });
  });

  describe('recordPurchaseReversal', () => {
    it('crea ADJUSTMENT con cantidad opuesta a la compra original y suma al stock', async () => {
      const { prismaService, mockTx } = createMockPrismaService();
      const service = new StockService(prismaService);

      mockTx.stockMovement.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(movement({ id: 'mov-original', quantity: new Decimal(10) }));

      const result = await service.recordPurchaseReversal({
        expenseItemId: 'ei-1',
        reason: 'expense deleted',
        userId: 'user-1',
      });

      expect(result).not.toBeNull();
      expect(mockTx.stockMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          productId: 'prod-1',
          type: StockMovementType.ADJUSTMENT,
          expenseItemId: 'ei-1',
          reason: 'expense deleted',
          userId: 'user-1',
        }),
      });
      const createdData = mockTx.stockMovement.create.mock.calls[0][0].data;
      expect(createdData.quantity.toString()).toBe('-10');

      const updateCall = mockTx.product.update.mock.calls[0][0];
      expect(updateCall.data.stockActual.increment.toString()).toBe('-10');
    });

    it('es idempotente: si ya existe ADJUSTMENT para ese expenseItem, devuelve null', async () => {
      const { prismaService, mockTx } = createMockPrismaService();
      const service = new StockService(prismaService);

      mockTx.stockMovement.findFirst.mockResolvedValueOnce({ id: 'existing-adj' });

      const result = await service.recordPurchaseReversal({
        expenseItemId: 'ei-1',
        reason: 'x',
        userId: 'user-1',
      });

      expect(result).toBeNull();
      expect(mockTx.stockMovement.create).not.toHaveBeenCalled();
    });

    it('es no-op si no hay PURCHASE original', async () => {
      const { prismaService, mockTx } = createMockPrismaService();
      const service = new StockService(prismaService);

      mockTx.stockMovement.findFirst.mockResolvedValue(null);

      const result = await service.recordPurchaseReversal({
        expenseItemId: 'ei-1',
        reason: 'x',
        userId: 'user-1',
      });

      expect(result).toBeNull();
      expect(mockTx.stockMovement.create).not.toHaveBeenCalled();
    });

    it('usa la tx externa si se pasa', async () => {
      const { prismaService, client, mockTx } = createMockPrismaService();
      const service = new StockService(prismaService);

      mockTx.stockMovement.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(movement({ id: 'mov-original', quantity: new Decimal(10) }));

      await service.recordPurchaseReversal(
        { expenseItemId: 'ei-1', reason: 'x', userId: 'user-1' },
        mockTx as any
      );

      expect(client.$transaction).not.toHaveBeenCalled();
      expect(mockTx.stockMovement.create).toHaveBeenCalledTimes(1);
    });

    it('rechaza reason vacío', async () => {
      const { prismaService } = createMockPrismaService();
      const service = new StockService(prismaService);

      await expect(
        service.recordPurchaseReversal({ expenseItemId: 'ei', reason: '', userId: 'u' })
      ).rejects.toMatchObject({ code: 'STOCK_REASON_REQUIRED' });
    });
  });

  describe('recordSaleForOrderItem', () => {
    it('lanza ORDER_ITEM_NOT_FOUND si el order item no existe', async () => {
      const { prismaService, mockTx } = createMockPrismaService();
      const service = new StockService(prismaService);

      mockTx.orderItem.findUnique.mockResolvedValue(null);

      await expect(service.recordSaleForOrderItem('oi-1', 'user-1')).rejects.toMatchObject({
        code: 'ORDER_ITEM_NOT_FOUND',
      });
    });

    it('descuenta cada ingrediente de la receta del MenuItem', async () => {
      const { prismaService, mockTx } = createMockPrismaService();
      const service = new StockService(prismaService);

      mockTx.orderItem.findUnique.mockResolvedValue({
        id: 'oi-1',
        quantity: 2,
        menuItem: {
          productId: null,
          ingredients: [{ productId: 'ing-1', quantity: 0.5, unit: null }],
        },
        productId: null,
        extras: [],
      });
      mockTx.product.findUnique.mockResolvedValue(product({ id: 'ing-1' }));

      const movements = await service.recordSaleForOrderItem('oi-1', 'user-1');

      expect(movements).toHaveLength(1);
      expect(movements[0]).toMatchObject({ type: StockMovementType.SALE, orderItemId: 'oi-1' });
      const createdData = mockTx.stockMovement.create.mock.calls[0][0].data;
      expect(createdData.quantity.toString()).toBe('-1'); // 0.5 * 2 = 1, negado
      const updateCall = mockTx.product.update.mock.calls[0][0];
      expect(updateCall.data.stockActual.increment.toString()).toBe('-1');
    });

    it('salta ingredientes de productos no encontrados o sin trackStock', async () => {
      const { prismaService, mockTx } = createMockPrismaService();
      const service = new StockService(prismaService);

      mockTx.orderItem.findUnique.mockResolvedValue({
        id: 'oi-1',
        quantity: 1,
        menuItem: {
          productId: null,
          ingredients: [
            { productId: 'missing', quantity: 1, unit: null },
            { productId: 'no-track', quantity: 1, unit: null },
          ],
        },
        productId: null,
        extras: [],
      });
      mockTx.product.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(product({ id: 'no-track', trackStock: false }));

      const movements = await service.recordSaleForOrderItem('oi-1', 'user-1');

      expect(movements).toHaveLength(0);
      expect(mockTx.stockMovement.create).not.toHaveBeenCalled();
    });

    it('descuenta 1:1 el producto directo de un MenuItem sin receta', async () => {
      const { prismaService, mockTx } = createMockPrismaService();
      const service = new StockService(prismaService);

      mockTx.orderItem.findUnique.mockResolvedValue({
        id: 'oi-1',
        quantity: 3,
        menuItem: { productId: 'prod-1', ingredients: [] },
        productId: null,
        extras: [],
      });
      mockTx.product.findUnique.mockResolvedValue(product());

      const movements = await service.recordSaleForOrderItem('oi-1', 'user-1');

      expect(movements).toHaveLength(1);
      const createdData = mockTx.stockMovement.create.mock.calls[0][0].data;
      expect(createdData.quantity.toString()).toBe('-3');
    });

    it('no descuenta un producto directo inexistente o sin trackStock', async () => {
      const { prismaService, mockTx } = createMockPrismaService();
      const service = new StockService(prismaService);

      mockTx.orderItem.findUnique.mockResolvedValue({
        id: 'oi-1',
        quantity: 1,
        menuItem: { productId: 'missing', ingredients: [] },
        productId: null,
        extras: [],
      });
      mockTx.product.findUnique.mockResolvedValue(null);

      const movements = await service.recordSaleForOrderItem('oi-1', 'user-1');

      expect(movements).toHaveLength(0);
      expect(mockTx.stockMovement.create).not.toHaveBeenCalled();
    });

    it('descuenta el productId directo de un OrderItem histórico (sin menuItem)', async () => {
      const { prismaService, mockTx } = createMockPrismaService();
      const service = new StockService(prismaService);

      mockTx.orderItem.findUnique.mockResolvedValue({
        id: 'oi-1',
        quantity: 2,
        menuItem: null,
        productId: 'prod-1',
        extras: [],
      });
      mockTx.product.findUnique.mockResolvedValue(product());

      const movements = await service.recordSaleForOrderItem('oi-1', 'user-1');

      expect(movements).toHaveLength(1);
      const createdData = mockTx.stockMovement.create.mock.calls[0][0].data;
      expect(createdData.quantity.toString()).toBe('-2');
    });

    it('no genera movements si no hay menuItem ni productId', async () => {
      const { prismaService, mockTx } = createMockPrismaService();
      const service = new StockService(prismaService);

      mockTx.orderItem.findUnique.mockResolvedValue({
        id: 'oi-1',
        quantity: 1,
        menuItem: null,
        productId: null,
        extras: [],
      });

      const movements = await service.recordSaleForOrderItem('oi-1', 'user-1');

      expect(movements).toHaveLength(0);
      expect(mockTx.stockMovement.create).not.toHaveBeenCalled();
    });

    it('descuenta también los extras del OrderItem', async () => {
      const { prismaService, mockTx } = createMockPrismaService();
      const service = new StockService(prismaService);

      mockTx.orderItem.findUnique.mockResolvedValue({
        id: 'oi-1',
        quantity: 1,
        menuItem: { productId: 'prod-1', ingredients: [] },
        productId: null,
        extras: [
          {
            quantity: 2,
            extra: { productId: 'ing-extra', ingredients: [] },
          },
        ],
      });
      mockTx.product.findUnique
        .mockResolvedValueOnce(product()) // producto del menuItem
        .mockResolvedValueOnce(product({ id: 'ing-extra' })); // producto del extra

      const movements = await service.recordSaleForOrderItem('oi-1', 'user-1');

      expect(movements).toHaveLength(2);
      expect(mockTx.stockMovement.create).toHaveBeenCalledTimes(2);
      const secondData = mockTx.stockMovement.create.mock.calls[1][0].data;
      expect(secondData.productId).toBe('ing-extra');
      expect(secondData.quantity.toString()).toBe('-2');
    });

    it('usa la tx externa si se pasa', async () => {
      const { prismaService, client, mockTx } = createMockPrismaService();
      const service = new StockService(prismaService);

      mockTx.orderItem.findUnique.mockResolvedValue({
        id: 'oi-1',
        quantity: 1,
        menuItem: { productId: 'prod-1', ingredients: [] },
        productId: null,
        extras: [],
      });
      mockTx.product.findUnique.mockResolvedValue(product());

      await service.recordSaleForOrderItem('oi-1', 'user-1', mockTx as any);

      expect(client.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('recordSalesBatch', () => {
    const baseProductMap = (items: any[]): Map<string, any> =>
      new Map(items.map((p) => [p.id, p]));

    it('no-op si items está vacío', async () => {
      const { prismaService, mockTx } = createMockPrismaService();
      const service = new StockService(prismaService);

      await service.recordSalesBatch([], new Map(), 'user-1', mockTx as any);

      expect(mockTx.stockMovement.createMany).not.toHaveBeenCalled();
      expect(mockTx.product.update).not.toHaveBeenCalled();
    });

    it('descuenta ingredientes de receta, producto directo y extras, acumulando deltas', async () => {
      const { prismaService, mockTx } = createMockPrismaService();
      const service = new StockService(prismaService);

      const productMap = baseProductMap([
        product({ id: 'ing-1' }),
        product({ id: 'ing-2' }),
        product({ id: 'prod-x' }),
      ]);
      const items = [
        {
          orderItemId: 'oi-1',
          quantity: 2,
          menuItem: { productId: null, ingredients: [{ productId: 'ing-1', quantity: 0.5, unit: null }] },
          productId: null,
          extras: [{ quantity: 1, menuItem: { productId: 'ing-2', ingredients: [] } }],
        },
        {
          orderItemId: 'oi-2',
          quantity: 3,
          menuItem: null,
          productId: 'prod-x',
          extras: [],
        },
      ];

      await service.recordSalesBatch(items, productMap, 'user-1', mockTx as any);

      const rows = mockTx.stockMovement.createMany.mock.calls[0][0].data;
      expect(rows).toHaveLength(3);
      // ing-1: 0.5 * 2 = -1
      // ing-2: 1 * 1 = -1
      // prod-x: 3 = -3
      expect(rows.map((r: any) => r.productId)).toEqual(['ing-1', 'ing-2', 'prod-x']);

      const updates: Record<string, string> = {};
      for (const call of mockTx.product.update.mock.calls) {
        updates[call[0].where.id] = call[0].data.stockActual.increment.toString();
      }
      expect(updates).toEqual({ 'ing-1': '-1', 'ing-2': '-1', 'prod-x': '-3' });
    });

    it('ignora productos sin trackStock y no encontrados', async () => {
      const { prismaService, mockTx } = createMockPrismaService();
      const service = new StockService(prismaService);

      const productMap = baseProductMap([product({ id: 'tracked' }), product({ id: 'no-track', trackStock: false })]);
      const items = [
        {
          orderItemId: 'oi-1',
          quantity: 1,
          menuItem: null,
          productId: 'missing',
          extras: [],
        },
        {
          orderItemId: 'oi-2',
          quantity: 1,
          menuItem: null,
          productId: 'no-track',
          extras: [],
        },
        {
          orderItemId: 'oi-3',
          quantity: 1,
          menuItem: null,
          productId: 'tracked',
          extras: [],
        },
      ];

      await service.recordSalesBatch(items, productMap, 'user-1', mockTx as any);

      const rows = mockTx.stockMovement.createMany.mock.calls[0][0].data;
      expect(rows).toHaveLength(1);
      expect(rows[0].productId).toBe('tracked');
    });

    it('no-op si no se generó ningún movement', async () => {
      const { prismaService, mockTx } = createMockPrismaService();
      const service = new StockService(prismaService);

      await service.recordSalesBatch(
        [{ orderItemId: 'oi-1', quantity: 1, menuItem: null, productId: 'missing', extras: [] }],
        new Map(),
        'user-1',
        mockTx as any
      );

      expect(mockTx.stockMovement.createMany).not.toHaveBeenCalled();
    });

    it('advierte si el stock queda negativo', async () => {
      const { prismaService, mockTx } = createMockPrismaService();
      const service = new StockService(prismaService);

      const productMap = baseProductMap([product({ id: 'prod-x', stockActual: new Decimal(1) })]);
      const items = [
        {
          orderItemId: 'oi-1',
          quantity: 5,
          menuItem: null,
          productId: 'prod-x',
          extras: [],
        },
      ];

      await service.recordSalesBatch(items, productMap, 'user-1', mockTx as any);

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Stock negativo'));
    });
  });

  describe('reverseSaleForOrderItem', () => {
    it('es idempotente: devuelve [] si ya existe un SALE_REVERSAL', async () => {
      const { prismaService, mockTx } = createMockPrismaService();
      const service = new StockService(prismaService);

      mockTx.stockMovement.findFirst.mockResolvedValueOnce({ id: 'existing-reversal' });

      const result = await service.reverseSaleForOrderItem('oi-1', 'user-1', 'cancelled');

      expect(result).toEqual([]);
      expect(mockTx.stockMovement.create).not.toHaveBeenCalled();
    });

    it('devuelve [] si no hay ventas previas', async () => {
      const { prismaService, mockTx } = createMockPrismaService();
      const service = new StockService(prismaService);

      mockTx.stockMovement.findFirst.mockResolvedValueOnce(null);
      mockTx.stockMovement.findMany.mockResolvedValueOnce([]);

      const result = await service.reverseSaleForOrderItem('oi-1', 'user-1', 'cancelled');

      expect(result).toEqual([]);
      expect(mockTx.stockMovement.create).not.toHaveBeenCalled();
    });

    it('usa la tx externa si se pasa', async () => {
      const { prismaService, client, mockTx } = createMockPrismaService();
      const service = new StockService(prismaService);

      mockTx.stockMovement.findFirst.mockResolvedValueOnce(null);
      mockTx.stockMovement.findMany.mockResolvedValueOnce([movement({ type: StockMovementType.SALE })]);

      await service.reverseSaleForOrderItem('oi-1', 'user-1', 'cancelled', mockTx as any);

      expect(client.$transaction).not.toHaveBeenCalled();
      expect(mockTx.stockMovement.create).toHaveBeenCalledTimes(1);
    });

    it('revierte cada venta con SALE_REVERSAL y devuelve el stock', async () => {
      const { prismaService, mockTx } = createMockPrismaService();
      const service = new StockService(prismaService);

      mockTx.stockMovement.findFirst.mockResolvedValueOnce(null);
      mockTx.stockMovement.findMany.mockResolvedValueOnce([
        movement({ id: 's1', quantity: new Decimal(3), type: StockMovementType.SALE }),
        movement({ id: 's2', quantity: new Decimal(2), type: StockMovementType.SALE }),
      ]);

      const result = await service.reverseSaleForOrderItem('oi-1', 'user-1', 'cancelled');

      expect(result).toHaveLength(2);
      const created = mockTx.stockMovement.create.mock.calls.map((c: any) => c[0].data);
      expect(created.map((d: any) => d.quantity.toString())).toEqual(['-3', '-2']);
      expect(created.every((d: any) => d.type === StockMovementType.SALE_REVERSAL)).toBe(true);
      expect(created.every((d: any) => d.reason === 'cancelled')).toBe(true);
      expect(mockTx.product.update).toHaveBeenCalledTimes(2);
    });
  });

  describe('reverseSalesBatch', () => {
    it('no-op si orderItemIds está vacío', async () => {
      const { prismaService, mockTx } = createMockPrismaService();
      const service = new StockService(prismaService);

      await service.reverseSalesBatch([], 'user-1', 'cancelled', mockTx as any);

      expect(mockTx.stockMovement.findMany).not.toHaveBeenCalled();
      expect(mockTx.stockMovement.createMany).not.toHaveBeenCalled();
    });

    it('no-op si todos los items ya fueron revertidos', async () => {
      const { prismaService, mockTx } = createMockPrismaService();
      const service = new StockService(prismaService);

      mockTx.stockMovement.findMany.mockResolvedValueOnce([
        { orderItemId: 'oi-1' },
        { orderItemId: 'oi-2' },
      ]);

      await service.reverseSalesBatch(['oi-1', 'oi-2'], 'user-1', 'cancelled', mockTx as any);

      expect(mockTx.stockMovement.createMany).not.toHaveBeenCalled();
    });

    it('no-op si no hay ventas originales', async () => {
      const { prismaService, mockTx } = createMockPrismaService();
      const service = new StockService(prismaService);

      mockTx.stockMovement.findMany
        .mockResolvedValueOnce([]) // alreadyReversed
        .mockResolvedValueOnce([]); // sales

      await service.reverseSalesBatch(['oi-1'], 'user-1', 'cancelled', mockTx as any);

      expect(mockTx.stockMovement.createMany).not.toHaveBeenCalled();
    });

    it('revierte en bulk los items pendientes, ignorando los ya revertidos', async () => {
      const { prismaService, mockTx } = createMockPrismaService();
      const service = new StockService(prismaService);

      mockTx.stockMovement.findMany
        .mockResolvedValueOnce([{ orderItemId: 'oi-1' }]) // oi-1 ya revertido
        .mockResolvedValueOnce([
          movement({ id: 's1', productId: 'prod-1', quantity: new Decimal(5), type: StockMovementType.SALE, orderItemId: 'oi-2' }),
          movement({ id: 's2', productId: 'prod-2', quantity: new Decimal(1), type: StockMovementType.SALE, orderItemId: 'oi-2' }),
        ]);

      await service.reverseSalesBatch(['oi-1', 'oi-2'], 'user-1', 'cancelled', mockTx as any);

      const rows = mockTx.stockMovement.createMany.mock.calls[0][0].data;
      expect(rows).toHaveLength(2);
      expect(rows.map((r: any) => r.quantity.toString())).toEqual(['-5', '-1']);
      expect(rows.every((r: any) => r.type === StockMovementType.SALE_REVERSAL)).toBe(true);

      const updates: Record<string, string> = {};
      for (const call of mockTx.product.update.mock.calls) {
        updates[call[0].where.id] = call[0].data.stockActual.increment.toString();
      }
      expect(updates).toEqual({ 'prod-1': '-5', 'prod-2': '-1' });
    });
  });

  describe('recordWaste', () => {
    it('rechaza quantity <= 0', async () => {
      const { prismaService } = createMockPrismaService();
      const service = new StockService(prismaService);

      await expect(
        service.recordWaste({ productId: 'p', quantity: 0, reason: 'EXPIRED', userId: 'u' })
      ).rejects.toMatchObject({ code: 'STOCK_INVALID_QUANTITY' });
    });

    it('rechaza reason vacío', async () => {
      const { prismaService } = createMockPrismaService();
      const service = new StockService(prismaService);

      await expect(
        service.recordWaste({ productId: 'p', quantity: 1, reason: '' as any, userId: 'u' })
      ).rejects.toMatchObject({ code: 'STOCK_REASON_REQUIRED' });
    });

    it('rechaza un motivo inválido', async () => {
      const { prismaService } = createMockPrismaService();
      const service = new StockService(prismaService);

      await expect(
        service.recordWaste({ productId: 'p', quantity: 1, reason: 'NOPE' as any, userId: 'u' })
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('lanza PRODUCT_NOT_FOUND si el producto no existe', async () => {
      const { prismaService, mockTx } = createMockPrismaService();
      const service = new StockService(prismaService);

      mockTx.product.findUnique.mockResolvedValue(null);

      await expect(
        service.recordWaste({ productId: 'missing', quantity: 1, reason: 'EXPIRED', userId: 'u' })
      ).rejects.toMatchObject({ code: 'PRODUCT_NOT_FOUND' });
    });

    it('es no-op si el producto no trackea stock', async () => {
      const { prismaService, mockTx } = createMockPrismaService();
      const service = new StockService(prismaService);

      mockTx.product.findUnique.mockResolvedValue(product({ trackStock: false }));

      const result = await service.recordWaste({ productId: 'prod-1', quantity: 1, reason: 'EXPIRED', userId: 'u' });

      expect(result).toBeNull();
      expect(mockTx.stockMovement.create).not.toHaveBeenCalled();
    });

    it('crea movement WASTE y descuenta stock', async () => {
      const { prismaService, mockTx } = createMockPrismaService();
      const service = new StockService(prismaService);

      mockTx.product.findUnique.mockResolvedValue(product());

      const result = await service.recordWaste({
        productId: 'prod-1',
        quantity: 4,
        reason: 'EXPIRED',
        userId: 'user-1',
        notes: 'quemado',
      });

      expect(result).not.toBeNull();
      const createdData = mockTx.stockMovement.create.mock.calls[0][0].data;
      expect(createdData.type).toBe(StockMovementType.WASTE);
      expect(createdData.reason).toBe('EXPIRED');
      expect(createdData.notes).toBe('quemado');
      expect(createdData.quantity.toString()).toBe('-4');
      expect(mockTx.product.update.mock.calls[0][0].data.stockActual.increment.toString()).toBe('-4');
    });

    it('advierte si el stock queda negativo', async () => {
      const { prismaService, mockTx } = createMockPrismaService();
      const service = new StockService(prismaService);

      mockTx.product.findUnique.mockResolvedValue(product({ stockActual: new Decimal(1) }));

      await service.recordWaste({ productId: 'prod-1', quantity: 5, reason: 'THEFT', userId: 'u' });

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Stock negativo'));
    });
  });

  describe('recordAdjustment', () => {
    it('rechaza newStock negativo', async () => {
      const { prismaService } = createMockPrismaService();
      const service = new StockService(prismaService);

      await expect(
        service.recordAdjustment({ productId: 'p', newStock: -1, reason: 'count', userId: 'u' })
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('rechaza reason vacío', async () => {
      const { prismaService } = createMockPrismaService();
      const service = new StockService(prismaService);

      await expect(
        service.recordAdjustment({ productId: 'p', newStock: 5, reason: '  ', userId: 'u' })
      ).rejects.toMatchObject({ code: 'STOCK_REASON_REQUIRED' });
    });

    it('lanza PRODUCT_NOT_FOUND si el producto no existe', async () => {
      const { prismaService, mockTx } = createMockPrismaService();
      const service = new StockService(prismaService);

      mockTx.product.findUnique.mockResolvedValue(null);

      await expect(
        service.recordAdjustment({ productId: 'missing', newStock: 5, reason: 'count', userId: 'u' })
      ).rejects.toMatchObject({ code: 'PRODUCT_NOT_FOUND' });
    });

    it('es no-op si el producto no trackea stock', async () => {
      const { prismaService, mockTx } = createMockPrismaService();
      const service = new StockService(prismaService);

      mockTx.product.findUnique.mockResolvedValue(product({ trackStock: false }));

      const result = await service.recordAdjustment({ productId: 'prod-1', newStock: 5, reason: 'count', userId: 'u' });

      expect(result).toBeNull();
    });

    it('es no-op si la diferencia es 0', async () => {
      const { prismaService, mockTx } = createMockPrismaService();
      const service = new StockService(prismaService);

      mockTx.product.findUnique.mockResolvedValue(product());

      const result = await service.recordAdjustment({ productId: 'prod-1', newStock: 10, reason: 'count', userId: 'u' });

      expect(result).toBeNull();
      expect(mockTx.stockMovement.create).not.toHaveBeenCalled();
    });

    it('crea movement ADJUSTMENT con la diferencia y setea el stock', async () => {
      const { prismaService, mockTx } = createMockPrismaService();
      const service = new StockService(prismaService);

      mockTx.product.findUnique.mockResolvedValue(product({ stockActual: new Decimal(7) }));

      const result = await service.recordAdjustment({
        productId: 'prod-1',
        newStock: 12,
        reason: 'inventario físico',
        userId: 'user-1',
      });

      expect(result).not.toBeNull();
      const createdData = mockTx.stockMovement.create.mock.calls[0][0].data;
      expect(createdData.type).toBe(StockMovementType.ADJUSTMENT);
      expect(createdData.quantity.toString()).toBe('5'); // 12 - 7
      expect(createdData.reason).toBe('inventario físico');
      expect(mockTx.product.update.mock.calls[0][0].data.stockActual.toString()).toBe('12');
    });
  });

  describe('lecturas (getPrisma)', () => {
    let readClient: any;

    beforeEach(() => {
      readClient = {
        product: {
          findMany: jest.fn(),
          findUnique: jest.fn(),
          update: jest.fn(),
        },
        stockMovement: {
          findMany: jest.fn(),
        },
      };
      mockGetPrisma.mockReturnValue(readClient);
    });

    function makeService(): StockService {
      const { prismaService } = createMockPrismaService();
      return new StockService(prismaService);
    }

    describe('getStockSummary', () => {
      it('filtra solo productos con trackStock por defecto y mapea el resumen', async () => {
        readClient.product.findMany.mockResolvedValue([
          product({ id: 'p1', name: 'Harina' }),
          product({ id: 'p2', name: 'Azúcar', minStockAlert: new Decimal(8), stockActual: new Decimal(3) }),
        ]);
        const service = makeService();

        const summary = await service.getStockSummary();

        expect(readClient.product.findMany).toHaveBeenCalledWith({
          where: { trackStock: true },
          orderBy: { name: 'asc' },
        });
        expect(summary).toHaveLength(2);
        expect(summary[0]).toMatchObject({
          productId: 'p1',
          name: 'Harina',
          trackStock: true,
          isLowStock: false,
        });
        expect(summary[1].isLowStock).toBe(true);
      });

      it('aplica search y lowStockOnly (descartando productos sin minStockAlert)', async () => {
        readClient.product.findMany.mockResolvedValue([
          product({ id: 'p1', name: 'Harina', minStockAlert: null }),
          product({ id: 'p2', name: 'Azúcar', minStockAlert: new Decimal(5), stockActual: new Decimal(3) }),
          product({ id: 'p3', name: 'Sal', minStockAlert: new Decimal(5), stockActual: new Decimal(10) }),
        ]);
        const service = makeService();

        const summary = await service.getStockSummary({ search: 'a', lowStockOnly: true });

        expect(readClient.product.findMany).toHaveBeenCalledWith({
          where: { trackStock: true, name: { contains: 'a' } },
          orderBy: { name: 'asc' },
        });
        expect(summary).toHaveLength(1);
        expect(summary[0].productId).toBe('p2');
      });

      it('incluye productos sin track cuando onlyTracked=false', async () => {
        readClient.product.findMany.mockResolvedValue([product({ id: 'p1' })]);
        const service = makeService();

        await service.getStockSummary({ onlyTracked: false });

        expect(readClient.product.findMany).toHaveBeenCalledWith({
          where: {},
          orderBy: { name: 'asc' },
        });
      });
    });

    describe('updateStockConfig', () => {
      it('lanza PRODUCT_NOT_FOUND si el producto no existe', async () => {
        readClient.product.findUnique.mockResolvedValue(null);
        const service = makeService();

        await expect(
          service.updateStockConfig('missing', { trackStock: true })
        ).rejects.toMatchObject({ code: 'PRODUCT_NOT_FOUND' });
      });

      it('actualiza trackStock, unitOfMeasure y minStockAlert', async () => {
        readClient.product.findUnique.mockResolvedValue(product());
        const service = makeService();

        await service.updateStockConfig('prod-1', {
          trackStock: false,
          unitOfMeasure: 'G',
          minStockAlert: new Decimal(2),
        });

        expect(readClient.product.update).toHaveBeenCalledWith({
          where: { id: 'prod-1' },
          data: { trackStock: false, unitOfMeasure: 'G', minStockAlert: expect.any(Object) },
        });
      });

      it('permite limpiar minStockAlert con null', async () => {
        readClient.product.findUnique.mockResolvedValue(product());
        const service = makeService();

        await service.updateStockConfig('prod-1', { minStockAlert: null });

        expect(readClient.product.update).toHaveBeenCalledWith({
          where: { id: 'prod-1' },
          data: { minStockAlert: null },
        });
      });
    });

    describe('getMovements', () => {
      it('devuelve movimientos con usuario y orden por fecha desc', async () => {
        readClient.stockMovement.findMany.mockResolvedValue([]);
        const service = makeService();

        await service.getMovements();

        expect(readClient.stockMovement.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {},
            include: { user: { select: { name: true, last_name: true, second_last_name: true } } },
            orderBy: { createdAt: 'desc' },
            take: 100,
            skip: 0,
          })
        );
      });

      it('construye el where con todos los filtros y limit/offset custom', async () => {
        readClient.stockMovement.findMany.mockResolvedValue([]);
        const service = makeService();

        const from = new Date('2026-01-01');
        const to = new Date('2026-01-31');
        await service.getMovements({ productId: 'p1', type: StockMovementType.SALE, reason: 'x', from, to, limit: 5, offset: 10 });

        expect(readClient.stockMovement.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              productId: 'p1',
              type: StockMovementType.SALE,
              reason: 'x',
              createdAt: { gte: from, lte: to },
            },
            take: 5,
            skip: 10,
          })
        );
      });
    });
  });
});
