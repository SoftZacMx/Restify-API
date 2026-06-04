import { CreateOrderUseCase } from '../../../../src/core/application/use-cases/orders/create-order.use-case';
import { IUserRepository } from '../../../../src/core/domain/interfaces/user-repository.interface';
import { ITableRepository } from '../../../../src/core/domain/interfaces/table-repository.interface';
import { IBranchRepository } from '../../../../src/core/domain/interfaces/branch-repository.interface';
import { PrismaService } from '../../../../src/core/infrastructure/config/prisma.config';
import { User } from '../../../../src/core/domain/entities/user.entity';
import { Table } from '../../../../src/core/domain/entities/table.entity';
import { UserRole, UserAccountStatus } from '@prisma/client';
import { AppError } from '../../../../src/shared/errors';

// El use case hace los bulk-loads (menuItem/product findMany) vía getPrisma()
// (cliente con tenant extension), no vía PrismaService. Lo redirigimos al
// mockClient activo para poder controlar/assertar esas lecturas.
let activePrismaClient: any;
jest.mock('../../../../src/core/infrastructure/database/prisma/get-prisma', () => ({
  getPrisma: () => activePrismaClient,
}));

// Mock prisma client + transaction. Soporta el flujo bulk-load (findMany fuera de tx)
// y createMany dentro de tx que usa la versión refactorizada del use case.
function createMockPrismaService(overrides: Record<string, any> = {}) {
  const mockTx = {
    order: {
      create: jest.fn().mockResolvedValue({
        id: 'order-123',
        date: new Date(),
        status: false,
        paymentMethod: 1,
        total: 20,
        subtotal: 20,
        iva: 0,
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
        ...overrides.order,
      }),
    },
    table: {
      update: jest.fn().mockResolvedValue({}),
    },
    orderItem: {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'order-item-123',
          quantity: 2,
          price: 10,
          orderId: 'order-123',
          productId: 'product-123',
          menuItemId: null,
          note: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]),
    },
    orderItemExtra: {
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    stockMovement: {
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    product: {
      update: jest.fn().mockResolvedValue({}),
    },
    $queryRaw: jest.fn().mockResolvedValue([]),
  };

  // Cliente fuera de tx: bulk-loads (menuItem/product findMany) corren acá.
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

describe('CreateOrderUseCase', () => {
  let createOrderUseCase: CreateOrderUseCase;
  let mockUserRepository: jest.Mocked<IUserRepository>;
  let mockTableRepository: jest.Mocked<ITableRepository>;
  let mockBranchRepository: jest.Mocked<IBranchRepository>;
  let mockPrismaService: ReturnType<typeof createMockPrismaService>;

  const mockUser = new User(
    'user-123', 'John', 'Doe', null, 'john@example.com',
    'hashed_password', null, true, UserRole.WAITER, 'org-123',
    UserAccountStatus.ACTIVE, 0, new Date(), false, new Date(), new Date()
  );

  // Filas Prisma "raw" (no entidades de dominio) — coinciden con lo que devuelven
  // los findMany de bulk-load. trackStock=false para evitar tocar stockMovement en
  // los tests genéricos.
  const mockProductRow = {
    id: 'product-123',
    name: 'Test Product',
    description: 'Description',
    registrationDate: new Date(),
    status: true,
    userId: 'user-123',
    stockActual: { isZero: () => true, plus: () => ({ lessThan: () => false }) } as any,
    unitOfMeasure: null,
    trackStock: false,
    minStockAlert: null,
    averageCost: 0 as any,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockMenuItemRow = {
    id: 'menu-item-123',
    name: 'Test Menu Item',
    price: 10.5 as any,
    status: true,
    isExtra: false,
    categoryId: 'category-123',
    userId: 'user-123',
    productId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ingredients: [],
  };

  beforeEach(() => {
    mockUserRepository = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findAll: jest.fn(),
      reactivate: jest.fn(),
      markForPasswordReset: jest.fn(),
      markEmailVerified: jest.fn(),
    };

    mockTableRepository = {
      findById: jest.fn(),
      findByName: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    mockBranchRepository = {
      findById: jest.fn().mockResolvedValue(null),
      findByIdAndOrganizationId: jest.fn(),
      findAllIdsByOrganizationId: jest.fn(),
      findManyByOrganizationId: jest.fn(),
      findManyForList: jest.fn(),
      countActiveByOrganizationId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };

    mockPrismaService = createMockPrismaService({ products: [mockProductRow], menuItems: [mockMenuItemRow] });

    const mockStockService = {
      recordSaleForOrderItem: jest.fn().mockResolvedValue([]),
      reverseSaleForOrderItem: jest.fn().mockResolvedValue([]),
      recordSalesBatch: jest.fn().mockResolvedValue(undefined),
    } as any;

    createOrderUseCase = new CreateOrderUseCase(
      mockUserRepository,
      mockTableRepository,
      mockBranchRepository,
      mockPrismaService as any,
      mockStockService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should create an order successfully with order items', async () => {
      const validInput = {
        userId: 'user-123',
        paymentMethod: 1,
        origin: 'Local',
        orderItems: [
          { productId: 'product-123', quantity: 2, price: 10.00, extras: [] },
        ],
        tip: 0,
        paymentDiffer: false,
      };

      mockUserRepository.findById.mockResolvedValue(mockUser);

      const result = await createOrderUseCase.execute(validInput);

      expect(result).toHaveProperty('id');
      expect(result.status).toBe(false);
      expect(result.orderItems).toHaveLength(1);
      expect(mockUserRepository.findById).toHaveBeenCalledWith('user-123');
      expect(mockPrismaService.mockClient.product.findMany).toHaveBeenCalled();
      expect(mockPrismaService.mockTx.orderItem.createMany).toHaveBeenCalled();
    });

    it('should create an order with menu items', async () => {
      const validInput = {
        userId: 'user-123',
        paymentMethod: 1,
        origin: 'Delivery',
        orderItems: [
          { menuItemId: 'menu-item-123', quantity: 3, price: 10.50, note: null, extras: [] },
        ],
        tip: 2.00,
        paymentDiffer: false,
      };

      mockUserRepository.findById.mockResolvedValue(mockUser);

      const result = await createOrderUseCase.execute(validInput);

      expect(result).toHaveProperty('id');
      expect(mockPrismaService.mockClient.menuItem.findMany).toHaveBeenCalled();
    });

    it('should create an order with table and mark it unavailable', async () => {
      const mockTable = new Table(
        'table-123', 'Mesa 1', 'user-123', true, true, new Date(), new Date()
      );

      const mockPrismaWithTable = createMockPrismaService({
        order: { tableId: 'table-123' },
        products: [mockProductRow],
        menuItems: [mockMenuItemRow],
      });

      const mockStockServiceLocal = {
        recordSaleForOrderItem: jest.fn().mockResolvedValue([]),
        reverseSaleForOrderItem: jest.fn().mockResolvedValue([]),
        recordSalesBatch: jest.fn().mockResolvedValue(undefined),
      } as any;

      const useCaseWithTable = new CreateOrderUseCase(
        mockUserRepository,
        mockTableRepository,
        mockBranchRepository,
        mockPrismaWithTable as any,
        mockStockServiceLocal,
      );

      const validInput = {
        userId: 'user-123',
        paymentMethod: 1,
        tableId: 'table-123',
        origin: 'Local',
        orderItems: [
          { productId: 'product-123', quantity: 1, price: 10.00, extras: [] },
        ],
        tip: 0,
        paymentDiffer: false,
      };

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockTableRepository.findById.mockResolvedValue(mockTable);

      await useCaseWithTable.execute(validInput);

      expect(mockPrismaWithTable.mockTx.table.update).toHaveBeenCalledWith({
        where: { id: 'table-123' },
        data: { availabilityStatus: false },
      });
    });

    it('should throw error when user not found', async () => {
      const validInput = {
        userId: 'user-123',
        paymentMethod: 1,
        origin: 'Local',
        orderItems: [
          { productId: 'product-123', quantity: 1, price: 10.00, extras: [] },
        ],
        tip: 0,
        paymentDiffer: false,
      };

      mockUserRepository.findById.mockResolvedValue(null);

      try {
        await createOrderUseCase.execute(validInput);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('USER_NOT_FOUND');
      }
    });

    it('should throw error when table not found', async () => {
      const validInput = {
        userId: 'user-123',
        paymentMethod: 1,
        tableId: 'table-123',
        origin: 'Local',
        orderItems: [
          { productId: 'product-123', quantity: 1, price: 10.00, extras: [] },
        ],
        tip: 0,
        paymentDiffer: false,
      };

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockTableRepository.findById.mockResolvedValue(null);

      try {
        await createOrderUseCase.execute(validInput);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('TABLE_NOT_FOUND');
      }
    });

    it('should throw error when product not found', async () => {
      // Bulk-load devuelve array vacío → product-123 no existe en el map.
      const mockPrismaNoProduct = createMockPrismaService({ products: [], menuItems: [] });
      const mockStockServiceLocal = {
        recordSaleForOrderItem: jest.fn(),
        reverseSaleForOrderItem: jest.fn(),
        recordSalesBatch: jest.fn(),
      } as any;
      const useCase = new CreateOrderUseCase(
        mockUserRepository,
        mockTableRepository,
        mockBranchRepository,
        mockPrismaNoProduct as any,
        mockStockServiceLocal,
      );

      const validInput = {
        userId: 'user-123',
        paymentMethod: 1,
        origin: 'Local',
        orderItems: [
          { productId: 'product-123', quantity: 1, price: 10.00, extras: [] },
        ],
        tip: 0,
        paymentDiffer: false,
      };

      mockUserRepository.findById.mockResolvedValue(mockUser);

      try {
        await useCase.execute(validInput);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('PRODUCT_NOT_FOUND');
      }
    });

    it('should throw error when menu item not found', async () => {
      const mockPrismaNoMenuItem = createMockPrismaService({ products: [], menuItems: [] });
      const mockStockServiceLocal = {
        recordSaleForOrderItem: jest.fn(),
        reverseSaleForOrderItem: jest.fn(),
        recordSalesBatch: jest.fn(),
      } as any;
      const useCase = new CreateOrderUseCase(
        mockUserRepository,
        mockTableRepository,
        mockBranchRepository,
        mockPrismaNoMenuItem as any,
        mockStockServiceLocal,
      );

      const validInput = {
        userId: 'user-123',
        paymentMethod: 1,
        origin: 'Local',
        orderItems: [
          { menuItemId: 'menu-item-123', quantity: 1, price: 10.50, extras: [] },
        ],
        tip: 0,
        paymentDiffer: false,
      };

      mockUserRepository.findById.mockResolvedValue(mockUser);

      try {
        await useCase.execute(validInput);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('MENU_ITEM_NOT_FOUND');
      }
    });
  });
});
