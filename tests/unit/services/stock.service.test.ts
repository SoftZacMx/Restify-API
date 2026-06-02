import { Prisma, StockMovementType } from '@prisma/client';
import { StockService } from '../../../src/core/application/services/stock.service';
import { PrismaService } from '../../../src/core/infrastructure/config/prisma.config';
import { AppError } from '../../../src/shared/errors';

const Decimal = Prisma.Decimal;

/**
 * Construye un mock de PrismaService cuyo `$transaction` ejecuta el callback con un mockTx
 * configurable. Devuelve también el mockTx para hacer aserciones / configurar respuestas.
 */
function createMockPrismaService() {
  const mockTx = {
    product: {
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    stockMovement: {
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'mov-id', ...data })),
      findFirst: jest.fn(),
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
  describe('recordPurchase', () => {
    it('recalcula averageCost con la fórmula ponderada y suma stock cuando trackStock=true', async () => {
      const { prismaService, mockTx } = createMockPrismaService();
      const service = new StockService(prismaService);

      // stock 10 con costo 5; comprar 5 a costo 7 -> nuevo avg = (10*5 + 5*7) / 15 = 5.6667
      mockTx.product.findUnique.mockResolvedValue({
        id: 'prod-1',
        stockActual: new Decimal(10),
        averageCost: new Decimal(5),
        trackStock: true,
      });

      const movement = await service.recordPurchase({
        productId: 'prod-1',
        quantity: 5,
        unitCost: 7,
        userId: 'user-1',
        expenseItemId: 'ei-1',
      });

      expect(movement).not.toBeNull();
      expect(mockTx.stockMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          productId: 'prod-1',
          type: StockMovementType.PURCHASE,
          expenseItemId: 'ei-1',
          userId: 'user-1',
        }),
      });

      const updateCall = mockTx.product.update.mock.calls[0][0];
      expect(updateCall.where).toEqual({ id: 'prod-1' });
      expect(updateCall.data.stockActual.toString()).toBe('15');
      // (10*5 + 5*7) / 15 = 85/15 = 5.6666...
      expect(parseFloat(updateCall.data.averageCost.toString())).toBeCloseTo(5.6667, 3);
    });

    it('actualiza averageCost pero NO crea movement ni mueve stock cuando trackStock=false', async () => {
      const { prismaService, mockTx } = createMockPrismaService();
      const service = new StockService(prismaService);

      mockTx.product.findUnique.mockResolvedValue({
        id: 'prod-1',
        stockActual: new Decimal(0),
        averageCost: new Decimal(0),
        trackStock: false,
      });

      const movement = await service.recordPurchase({
        productId: 'prod-1',
        quantity: 10,
        unitCost: 8,
        userId: 'user-1',
      });

      expect(movement).toBeNull();
      expect(mockTx.stockMovement.create).not.toHaveBeenCalled();
      const updateCall = mockTx.product.update.mock.calls[0][0];
      expect(updateCall.data).toEqual({ averageCost: expect.anything() });
      expect(updateCall.data.stockActual).toBeUndefined();
      expect(parseFloat(updateCall.data.averageCost.toString())).toBe(8);
    });

    it('cuando stock previo + comprado = 0 usa unitCost directo (caso borde)', async () => {
      const { prismaService, mockTx } = createMockPrismaService();
      const service = new StockService(prismaService);

      mockTx.product.findUnique.mockResolvedValue({
        id: 'prod-1',
        stockActual: new Decimal(0),
        averageCost: new Decimal(0),
        trackStock: true,
      });

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
      ).rejects.toThrow(AppError);
    });

    it('rechaza unitCost negativo', async () => {
      const { prismaService } = createMockPrismaService();
      const service = new StockService(prismaService);

      await expect(
        service.recordPurchase({ productId: 'p', quantity: 1, unitCost: -1, userId: 'u' })
      ).rejects.toThrow(AppError);
    });

    it('cuando recibe tx externa, NO abre $transaction propio (usa la heredada)', async () => {
      const { prismaService, client, mockTx } = createMockPrismaService();
      const service = new StockService(prismaService);

      mockTx.product.findUnique.mockResolvedValue({
        id: 'prod-1',
        stockActual: new Decimal(0),
        averageCost: new Decimal(0),
        trackStock: true,
      });

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
        .mockResolvedValueOnce(null) // no existe ADJUSTMENT previo (idempotencia)
        .mockResolvedValueOnce({
          // PURCHASE original
          id: 'mov-original',
          productId: 'prod-1',
          quantity: new Decimal(10),
          type: StockMovementType.PURCHASE,
        });

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
      expect(updateCall.where).toEqual({ id: 'prod-1' });
      expect(updateCall.data.stockActual.increment.toString()).toBe('-10');
    });

    it('es idempotente: si ya existe ADJUSTMENT para ese expenseItem, devuelve null y no crea nada', async () => {
      const { prismaService, mockTx } = createMockPrismaService();
      const service = new StockService(prismaService);

      mockTx.stockMovement.findFirst.mockResolvedValueOnce({ id: 'existing-adj' });

      const result = await service.recordPurchaseReversal({
        expenseItemId: 'ei-1',
        reason: 'expense deleted',
        userId: 'user-1',
      });

      expect(result).toBeNull();
      expect(mockTx.stockMovement.create).not.toHaveBeenCalled();
      expect(mockTx.product.update).not.toHaveBeenCalled();
    });

    it('es no-op si no hay PURCHASE original (caso trackStock=false al momento de la compra)', async () => {
      const { prismaService, mockTx } = createMockPrismaService();
      const service = new StockService(prismaService);

      mockTx.stockMovement.findFirst
        .mockResolvedValueOnce(null) // no ADJUSTMENT previo
        .mockResolvedValueOnce(null); // no PURCHASE original

      const result = await service.recordPurchaseReversal({
        expenseItemId: 'ei-1',
        reason: 'expense deleted',
        userId: 'user-1',
      });

      expect(result).toBeNull();
      expect(mockTx.stockMovement.create).not.toHaveBeenCalled();
      expect(mockTx.product.update).not.toHaveBeenCalled();
    });

    it('rechaza reason vacío', async () => {
      const { prismaService } = createMockPrismaService();
      const service = new StockService(prismaService);

      await expect(
        service.recordPurchaseReversal({ expenseItemId: 'ei', reason: '', userId: 'u' })
      ).rejects.toMatchObject({ code: 'STOCK_REASON_REQUIRED' });
    });
  });
});
