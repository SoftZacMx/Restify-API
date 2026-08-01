import { PublicOrderPersistenceService } from '../../../src/core/application/services/public-order-persistence.service';
import { PrismaService } from '../../../src/core/infrastructure/config/prisma.config';
import { AppError } from '../../../src/shared/errors';

// Los bulk-loads (menuItem/product findMany) corren vía getPrisma(), no PrismaService.
let activePrismaClient: any;
jest.mock('../../../src/core/infrastructure/database/prisma/get-prisma', () => ({
  getPrisma: () => activePrismaClient,
}));

// Filas Prisma "raw" — coinciden con lo que devuelve menuItem.findMany con include.
const mockMenuItemRow = {
  id: 'menu-1',
  name: 'Hamburguesa',
  price: 120 as any,
  status: true,
  isExtra: false,
  categoryId: 'cat-1',
  userId: 'user-1',
  productId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ingredients: [],
};

const mockExtraRow = {
  id: 'extra-1',
  name: 'Queso extra',
  price: 15 as any,
  status: true,
  isExtra: true,
  categoryId: 'cat-1',
  userId: 'user-1',
  productId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ingredients: [],
};

function createMockPrismaService(
  overrides: { order?: Record<string, any>; menuItems?: any[]; products?: any[] } = {}
) {
  const mockTx = {
    order: {
      create: jest.fn().mockResolvedValue({
        id: 'order-1',
        createdAt: new Date(),
        ...overrides.order,
      }),
    },
    orderItem: {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    orderItemExtra: {
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };

  const mockClient = {
    $transaction: jest.fn().mockImplementation((cb: Function) => cb(mockTx)),
    menuItem: {
      findMany: jest.fn().mockResolvedValue(overrides.menuItems ?? []),
    },
    product: {
      findMany: jest.fn().mockResolvedValue(overrides.products ?? []),
    },
  };

  // getPrisma() (bulk-loads) debe resolver a este mismo mockClient.
  activePrismaClient = mockClient;

  return {
    getClient: jest.fn().mockReturnValue(mockClient),
    connect: jest.fn(),
    disconnect: jest.fn(),
    healthCheck: jest.fn(),
    mockTx,
    mockClient,
  } as unknown as jest.Mocked<PrismaService> & { mockTx: typeof mockTx; mockClient: typeof mockClient };
}

describe('PublicOrderPersistenceService', () => {
  let service: PublicOrderPersistenceService;
  let mockPrismaService: ReturnType<typeof createMockPrismaService>;
  let mockStockService: any;

  function buildService(prismaOverrides: Parameters<typeof createMockPrismaService>[0] = {}) {
    mockPrismaService = createMockPrismaService(prismaOverrides);
    service = new PublicOrderPersistenceService(mockPrismaService as any, mockStockService);
  }

  beforeEach(() => {
    mockStockService = {
      recordSaleForOrderItem: jest.fn().mockResolvedValue([]),
      reverseSaleForOrderItem: jest.fn().mockResolvedValue([]),
      recordSalesBatch: jest.fn().mockResolvedValue(undefined),
      reverseSalesBatch: jest.fn().mockResolvedValue(undefined),
    };
    buildService({ menuItems: [mockMenuItemRow] });
  });

  afterEach(() => jest.clearAllMocks());

  describe('validateAndPrice', () => {
    it('should throw VALIDATION_ERROR when items is empty', async () => {
      await expect(service.validateAndPrice([])).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('should compute subtotal and total from base item price', async () => {
      const result = await service.validateAndPrice([{ menuItemId: 'menu-1', quantity: 2 }]);
      expect(result).toEqual({ subtotal: 240, total: 240 });
    });

    it('should include extras in the price', async () => {
      buildService({ menuItems: [mockMenuItemRow, mockExtraRow] });

      const result = await service.validateAndPrice([
        { menuItemId: 'menu-1', quantity: 1, extras: [{ extraId: 'extra-1', quantity: 2 }] },
      ]);
      // 120 * 1 + 15 * 2 = 150
      expect(result.total).toBe(150);
    });

    it('should throw MENU_ITEM_NOT_FOUND when a menu item is missing', async () => {
      buildService({ menuItems: [] });

      await expect(service.validateAndPrice([{ menuItemId: 'nope', quantity: 1 }]))
        .rejects.toMatchObject({ code: 'MENU_ITEM_NOT_FOUND' });
    });

    it('should throw MENU_ITEM_NOT_AVAILABLE when a menu item is inactive', async () => {
      buildService({ menuItems: [{ ...mockMenuItemRow, status: false }] });

      await expect(service.validateAndPrice([{ menuItemId: 'menu-1', quantity: 1 }]))
        .rejects.toMatchObject({ code: 'MENU_ITEM_NOT_AVAILABLE' });
    });

    it('should throw INVALID_MENU_ITEM when a base item is actually an extra', async () => {
      buildService({ menuItems: [mockExtraRow] });

      await expect(service.validateAndPrice([{ menuItemId: 'extra-1', quantity: 1 }]))
        .rejects.toMatchObject({ code: 'INVALID_MENU_ITEM' });
    });

    it('should throw MENU_ITEM_NOT_FOUND when an extra is missing', async () => {
      buildService({ menuItems: [mockMenuItemRow] });

      await expect(service.validateAndPrice([
        { menuItemId: 'menu-1', quantity: 1, extras: [{ extraId: 'nope', quantity: 1 }] },
      ])).rejects.toMatchObject({ code: 'MENU_ITEM_NOT_FOUND' });
    });

    it('should throw MENU_ITEM_NOT_AVAILABLE when an extra is inactive', async () => {
      buildService({ menuItems: [mockMenuItemRow, { ...mockExtraRow, status: false }] });

      await expect(service.validateAndPrice([
        { menuItemId: 'menu-1', quantity: 1, extras: [{ extraId: 'extra-1', quantity: 1 }] },
      ])).rejects.toMatchObject({ code: 'MENU_ITEM_NOT_AVAILABLE' });
    });

    it('should throw INVALID_EXTRA when the extra is not flagged as extra', async () => {
      buildService({ menuItems: [mockMenuItemRow, { ...mockExtraRow, isExtra: false }] });

      await expect(service.validateAndPrice([
        { menuItemId: 'menu-1', quantity: 1, extras: [{ extraId: 'extra-1', quantity: 1 }] },
      ])).rejects.toMatchObject({ code: 'INVALID_EXTRA' });
    });

    it('should not write anything', async () => {
      await service.validateAndPrice([{ menuItemId: 'menu-1', quantity: 1 }]);
      expect(mockPrismaService.mockClient.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('persistOrder', () => {
    const baseInput = {
      branchId: 'branch-1',
      customerName: 'Juan',
      customerPhone: '5512345678',
      orderType: 'PICKUP' as const,
      items: [{ menuItemId: 'menu-1', quantity: 1 }],
    };

    it('should create the order inside a transaction and return its id', async () => {
      const result = await service.persistOrder(baseInput);

      expect(mockPrismaService.mockClient.$transaction).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.mockTx.order.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: null,
          origin: 'online-pickup',
          customerName: 'Juan',
          branchId: 'branch-1',
        }),
      });
      expect(mockPrismaService.mockTx.orderItem.createMany).toHaveBeenCalled();
      expect(result.id).toBe('order-1');
    });

    it('should map DELIVERY orderType to online-delivery origin', async () => {
      const result = await service.persistOrder({ ...baseInput, orderType: 'DELIVERY' });
      expect(result.origin).toBe('online-delivery');
    });

    it('should recompute subtotal/total from current prices, ignoring any input price', async () => {
      const result = await service.persistOrder({ ...baseInput, items: [{ menuItemId: 'menu-1', quantity: 2 }] });
      expect(result.subtotal).toBe(240);
      expect(result.total).toBe(240);
    });

    it('should reuse the provided trackingToken', async () => {
      const result = await service.persistOrder({ ...baseInput, trackingToken: 'reused-token' });
      expect(result.trackingToken).toBe('reused-token');
      expect(mockPrismaService.mockTx.order.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ trackingToken: 'reused-token' }),
      });
    });

    it('should generate a trackingToken when none is provided', async () => {
      const result = await service.persistOrder(baseInput);
      expect(result.trackingToken).toBeDefined();
      expect(result.trackingToken.length).toBeGreaterThan(0);
    });

    it('should persist extras and record the stock sale batch', async () => {
      buildService({ menuItems: [mockMenuItemRow, mockExtraRow] });

      await service.persistOrder({
        ...baseInput,
        items: [{ menuItemId: 'menu-1', quantity: 1, extras: [{ extraId: 'extra-1', quantity: 1 }] }],
      });

      expect(mockPrismaService.mockTx.orderItemExtra.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ extraId: 'extra-1', price: 15 }),
        ]),
      });
      expect(mockStockService.recordSalesBatch).toHaveBeenCalledTimes(1);
    });

    it('should throw MENU_ITEM_NOT_FOUND when a menu item disappeared before persist', async () => {
      buildService({ menuItems: [] });

      await expect(service.persistOrder(baseInput))
        .rejects.toMatchObject({ code: 'MENU_ITEM_NOT_FOUND' });
    });

    it('should throw MENU_ITEM_NOT_FOUND when an extra disappeared before persist', async () => {
      buildService({ menuItems: [mockMenuItemRow] });

      await expect(service.persistOrder({
        ...baseInput,
        items: [{ menuItemId: 'menu-1', quantity: 1, extras: [{ extraId: 'nope', quantity: 1 }] }],
      })).rejects.toMatchObject({ code: 'MENU_ITEM_NOT_FOUND' });
    });

    it('should map ingredients and products into the stock sale batch', async () => {
      const baseWithIngredients = {
        ...mockMenuItemRow,
        productId: 'prod-1',
        ingredients: [{ productId: 'prod-1', quantity: 2, unit: 'kg' as const }],
      };
      const extraWithIngredients = {
        ...mockExtraRow,
        productId: 'prod-2',
        ingredients: [{ productId: 'prod-2', quantity: 1, unit: 'u' as const }],
      };
      buildService({ menuItems: [baseWithIngredients, extraWithIngredients] });

      await service.persistOrder({
        ...baseInput,
        items: [{ menuItemId: 'menu-1', quantity: 1, extras: [{ extraId: 'extra-1', quantity: 1 }] }],
      });

      const saleBatch = mockStockService.recordSalesBatch.mock.calls[0][0];
      expect(saleBatch[0]).toEqual(expect.objectContaining({
        menuItem: expect.objectContaining({
          productId: 'prod-1',
          ingredients: [{ productId: 'prod-1', quantity: 2, unit: 'kg' }],
        }),
        extras: [
          expect.objectContaining({
            menuItem: expect.objectContaining({
              productId: 'prod-2',
              ingredients: [{ productId: 'prod-2', quantity: 1, unit: 'u' }],
            }),
          }),
        ],
      }));
      expect(mockStockService.recordSalesBatch.mock.calls[0][2]).toBeNull();
    });
  });
});
