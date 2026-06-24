import { CreatePublicOrderUseCase } from '../../../../src/core/application/use-cases/orders/create-public-order.use-case';
import { IMenuItemRepository } from '../../../../src/core/domain/interfaces/menu-item-repository.interface';
import { IBranchRepository } from '../../../../src/core/domain/interfaces/branch-repository.interface';
import { Branch } from '../../../../src/core/domain/entities/branch.entity';
import { PrismaService } from '../../../../src/core/infrastructure/config/prisma.config';
import { AppError } from '../../../../src/shared/errors';

// Los bulk-loads (menuItem/product findMany) corren vía getPrisma(), no PrismaService.
let activePrismaClient: any;
jest.mock('../../../../src/core/infrastructure/database/prisma/get-prisma', () => ({
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
        date: new Date(),
        status: false,
        paymentMethod: null,
        total: 120,
        subtotal: 120,
        iva: 0,
        delivered: false,
        tableId: null,
        tip: 0,
        origin: 'online-delivery',
        client: null,
        paymentDiffer: false,
        note: null,
        userId: null,
        customerName: 'Juan',
        customerPhone: '5512345678',
        trackingToken: 'token-abc',
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides.order,
      }),
    },
    orderItem: {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    orderItemExtra: {
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    stockMovement: {
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    product: {
      update: jest.fn().mockResolvedValue({}),
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

describe('CreatePublicOrderUseCase', () => {
  let useCase: CreatePublicOrderUseCase;
  let mockMenuItemRepository: jest.Mocked<IMenuItemRepository>;
  let mockBranchRepository: jest.Mocked<IBranchRepository>;
  let mockPrismaService: ReturnType<typeof createMockPrismaService>;
  let mockStockService: any;

  function buildUseCase(prismaOverrides: Parameters<typeof createMockPrismaService>[0] = {}): CreatePublicOrderUseCase {
    mockPrismaService = createMockPrismaService(prismaOverrides);
    return new CreatePublicOrderUseCase(
      mockMenuItemRepository,
      mockBranchRepository,
      mockPrismaService as any,
      mockStockService,
    );
  }

  // Branch base: sin horarios de operación (permite cualquier hora).
  function makeBranch(overrides: Partial<{ startOperations: string | null; endOperations: string | null }> = {}): Branch {
    return new Branch(
      'branch-1', 'org-1', 'Sucursal Centro', 'CDMX', 'CDMX', 'Calle 1', '10',
      '5512345678', null, null,
      overrides.startOperations ?? null,
      overrides.endOperations ?? null,
      null, null, 'America/Mexico_City', 'MXN', 'active',
      new Date(), new Date(), null
    );
  }

  beforeEach(() => {
    mockMenuItemRepository = {
      findById: jest.fn(),
      findByIds: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    mockBranchRepository = {
      findById: jest.fn().mockResolvedValue(makeBranch()),
      findBySlug: jest.fn(),
      findByIdAndOrganizationId: jest.fn(),
      findAllIdsByOrganizationId: jest.fn(),
      findManyByOrganizationId: jest.fn(),
      findManyForList: jest.fn(),
      countActiveByOrganizationId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };

    mockStockService = {
      recordSaleForOrderItem: jest.fn().mockResolvedValue([]),
      reverseSaleForOrderItem: jest.fn().mockResolvedValue([]),
      recordSalesBatch: jest.fn().mockResolvedValue(undefined),
      reverseSalesBatch: jest.fn().mockResolvedValue(undefined),
    };

    useCase = buildUseCase({ menuItems: [mockMenuItemRow] });
  });

  afterEach(() => jest.clearAllMocks());

  it('should create a delivery order with userId null and trackingToken', async () => {
    const result = await useCase.execute({
      branchId: 'branch-1',
      customerName: 'Juan',
      customerPhone: '5512345678',
      orderType: 'DELIVERY',
      deliveryAddress: 'Calle 1',
      latitude: 19.43,
      longitude: -99.13,
      items: [{ menuItemId: 'menu-1', quantity: 1 }],
    });

    expect(result.trackingToken).toBeDefined();
    expect(result.origin).toBe('online-delivery');
    expect(result.customerName).toBe('Juan');
    expect(mockPrismaService.mockTx.order.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: null,
        origin: 'online-delivery',
        customerName: 'Juan',
        customerPhone: '5512345678',
      }),
    });
  });

  it('should create a pickup order with origin online-pickup', async () => {
    useCase = buildUseCase({ menuItems: [mockMenuItemRow], order: { origin: 'online-pickup' } });

    const result = await useCase.execute({
      branchId: 'branch-1',
      customerName: 'Maria',
      customerPhone: '5598765432',
      orderType: 'PICKUP',
      items: [{ menuItemId: 'menu-1', quantity: 1 }],
    });

    expect(result.origin).toBe('online-pickup');
  });

  it('should throw error when items array is empty', async () => {
    await expect(useCase.execute({
      branchId: 'branch-1',
      customerName: 'Juan',
      customerPhone: '5512345678',
      orderType: 'DELIVERY',
      items: [],
    })).rejects.toThrow(AppError);
  });

  it('should throw error when menu item not found', async () => {
    useCase = buildUseCase({ menuItems: [] });

    await expect(useCase.execute({
      branchId: 'branch-1',
      customerName: 'Juan',
      customerPhone: '5512345678',
      orderType: 'DELIVERY',
      items: [{ menuItemId: 'nonexistent', quantity: 1 }],
    })).rejects.toMatchObject({ code: 'MENU_ITEM_NOT_FOUND' });
  });

  it('should throw error when menu item is inactive', async () => {
    useCase = buildUseCase({ menuItems: [{ ...mockMenuItemRow, status: false }] });

    await expect(useCase.execute({
      branchId: 'branch-1',
      customerName: 'Juan',
      customerPhone: '5512345678',
      orderType: 'DELIVERY',
      items: [{ menuItemId: 'menu-1', quantity: 1 }],
    })).rejects.toMatchObject({ code: 'MENU_ITEM_NOT_AVAILABLE' });
  });

  it('should throw error when menu item is an extra', async () => {
    useCase = buildUseCase({ menuItems: [mockExtraRow] });

    await expect(useCase.execute({
      branchId: 'branch-1',
      customerName: 'Juan',
      customerPhone: '5512345678',
      orderType: 'DELIVERY',
      items: [{ menuItemId: 'extra-1', quantity: 1 }],
    })).rejects.toMatchObject({ code: 'INVALID_MENU_ITEM' });
  });

  it('should use transaction for order + items creation', async () => {
    await useCase.execute({
      branchId: 'branch-1',
      customerName: 'Juan',
      customerPhone: '5512345678',
      orderType: 'DELIVERY',
      items: [{ menuItemId: 'menu-1', quantity: 1 }],
    });

    expect(mockPrismaService.mockClient.$transaction).toHaveBeenCalled();
    expect(mockPrismaService.mockTx.order.create).toHaveBeenCalled();
    expect(mockPrismaService.mockTx.orderItem.createMany).toHaveBeenCalled();
  });

  it('should create extras inside transaction', async () => {
    useCase = buildUseCase({ menuItems: [mockMenuItemRow, mockExtraRow] });

    await useCase.execute({
      branchId: 'branch-1',
      customerName: 'Juan',
      customerPhone: '5512345678',
      orderType: 'DELIVERY',
      items: [{
        menuItemId: 'menu-1',
        quantity: 2,
        extras: [{ extraId: 'extra-1', quantity: 1 }],
      }],
    });

    expect(mockPrismaService.mockTx.orderItemExtra.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ extraId: 'extra-1', price: 15 }),
      ]),
    });
  });

  it('should throw OUTSIDE_OPERATING_HOURS when current time is outside hours', async () => {
    mockBranchRepository.findById.mockResolvedValue(
      makeBranch({ startOperations: '09:00', endOperations: '22:00' })
    );

    await expect(useCase.execute({
      branchId: 'branch-1',
      customerName: 'Juan',
      customerPhone: '5512345678',
      orderType: 'PICKUP',
      scheduledAt: new Date(2026, 3, 12, 23, 0).toISOString(),
      items: [{ menuItemId: 'menu-1', quantity: 1 }],
    })).rejects.toMatchObject({ code: 'OUTSIDE_OPERATING_HOURS' });
  });

  it('should allow order when no operating hours configured', async () => {
    mockBranchRepository.findById.mockResolvedValue(makeBranch());

    const result = await useCase.execute({
      branchId: 'branch-1',
      customerName: 'Juan',
      customerPhone: '5512345678',
      orderType: 'DELIVERY',
      items: [{ menuItemId: 'menu-1', quantity: 1 }],
    });

    expect(result.trackingToken).toBeDefined();
  });
});
