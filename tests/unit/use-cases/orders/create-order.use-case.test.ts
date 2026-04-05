import { CreateOrderUseCase } from '../../../../src/core/application/use-cases/orders/create-order.use-case';
import { IUserRepository } from '../../../../src/core/domain/interfaces/user-repository.interface';
import { ITableRepository } from '../../../../src/core/domain/interfaces/table-repository.interface';
import { IProductRepository } from '../../../../src/core/domain/interfaces/product-repository.interface';
import { IMenuItemRepository } from '../../../../src/core/domain/interfaces/menu-item-repository.interface';
import { ICompanyRepository } from '../../../../src/core/domain/interfaces/company-repository.interface';
import { PrismaService } from '../../../../src/core/infrastructure/config/prisma.config';
import { User } from '../../../../src/core/domain/entities/user.entity';
import { Table } from '../../../../src/core/domain/entities/table.entity';
import { Product } from '../../../../src/core/domain/entities/product.entity';
import { MenuItem } from '../../../../src/core/domain/entities/menu-item.entity';
import { UserRole } from '@prisma/client';
import { AppError } from '../../../../src/shared/errors';

// Mock transaction: executes the callback with a mock tx that returns realistic data
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
      create: jest.fn().mockResolvedValue({
        id: 'order-item-123',
        quantity: 2,
        price: 10,
        orderId: 'order-123',
        productId: 'product-123',
        menuItemId: null,
        note: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
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
      create: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
    },
    $queryRaw: jest.fn().mockResolvedValue([]),
  };

  return {
    getClient: jest.fn().mockReturnValue({
      $transaction: jest.fn().mockImplementation((cb: Function) => cb(mockTx)),
    }),
    connect: jest.fn(),
    disconnect: jest.fn(),
    healthCheck: jest.fn(),
    mockTx,
  } as unknown as jest.Mocked<PrismaService> & { mockTx: typeof mockTx };
}

describe('CreateOrderUseCase', () => {
  let createOrderUseCase: CreateOrderUseCase;
  let mockUserRepository: jest.Mocked<IUserRepository>;
  let mockTableRepository: jest.Mocked<ITableRepository>;
  let mockProductRepository: jest.Mocked<IProductRepository>;
  let mockMenuItemRepository: jest.Mocked<IMenuItemRepository>;
  let mockCompanyRepository: jest.Mocked<ICompanyRepository>;
  let mockPrismaService: ReturnType<typeof createMockPrismaService>;

  const mockUser = new User(
    'user-123', 'John', 'Doe', null, 'john@example.com',
    'hashed_password', null, true, UserRole.WAITER, new Date(), new Date()
  );

  const mockProduct = new Product(
    'product-123', 'Test Product', 'Description',
    new Date(), true, 'user-123', new Date(), new Date()
  );

  const mockMenuItem = new MenuItem(
    'menu-item-123', 'Test Menu Item', 10.50, true, false,
    'category-123', 'user-123', new Date(), new Date()
  );

  beforeEach(() => {
    mockUserRepository = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findAll: jest.fn(),
      reactivate: jest.fn(),
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

    mockCompanyRepository = {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn(),
    };

    mockPrismaService = createMockPrismaService();

    createOrderUseCase = new CreateOrderUseCase(
      mockUserRepository,
      mockTableRepository,
      mockProductRepository,
      mockMenuItemRepository,
      mockCompanyRepository,
      mockPrismaService as any,
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
      mockProductRepository.findById.mockResolvedValue(mockProduct);

      const result = await createOrderUseCase.execute(validInput);

      expect(result).toHaveProperty('id');
      expect(result.status).toBe(false);
      expect(result.orderItems).toHaveLength(1);
      expect(mockUserRepository.findById).toHaveBeenCalledWith('user-123');
      expect(mockProductRepository.findById).toHaveBeenCalledWith('product-123');
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
      mockMenuItemRepository.findById.mockResolvedValue(mockMenuItem);

      const result = await createOrderUseCase.execute(validInput);

      expect(result).toHaveProperty('id');
      expect(mockMenuItemRepository.findById).toHaveBeenCalledWith('menu-item-123');
    });

    it('should create an order with table and mark it unavailable', async () => {
      const mockTable = new Table(
        'table-123', 'Mesa 1', 'user-123', true, true, new Date(), new Date()
      );

      const mockPrismaWithTable = createMockPrismaService({
        order: { tableId: 'table-123' },
      });

      const useCaseWithTable = new CreateOrderUseCase(
        mockUserRepository,
        mockTableRepository,
        mockProductRepository,
        mockMenuItemRepository,
        mockCompanyRepository,
        mockPrismaWithTable as any,
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
      mockProductRepository.findById.mockResolvedValue(mockProduct);

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
      mockProductRepository.findById.mockResolvedValue(null);

      try {
        await createOrderUseCase.execute(validInput);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('PRODUCT_NOT_FOUND');
      }
    });

    it('should throw error when menu item not found', async () => {
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
      mockMenuItemRepository.findById.mockResolvedValue(null);

      try {
        await createOrderUseCase.execute(validInput);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('MENU_ITEM_NOT_FOUND');
      }
    });
  });
});
