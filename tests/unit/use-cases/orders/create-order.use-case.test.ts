import { CreateOrderUseCase } from '../../../../src/core/application/use-cases/orders/create-order.use-case';
import { IOrderRepository } from '../../../../src/core/domain/interfaces/order-repository.interface';
import { IUserRepository } from '../../../../src/core/domain/interfaces/user-repository.interface';
import { ITableRepository } from '../../../../src/core/domain/interfaces/table-repository.interface';
import { IProductRepository } from '../../../../src/core/domain/interfaces/product-repository.interface';
import { IMenuItemRepository } from '../../../../src/core/domain/interfaces/menu-item-repository.interface';
import { ICompanyRepository } from '../../../../src/core/domain/interfaces/company-repository.interface';
import { Order } from '../../../../src/core/domain/entities/order.entity';
import { OrderItem } from '../../../../src/core/domain/entities/order-item.entity';
import { User } from '../../../../src/core/domain/entities/user.entity';
import { Table } from '../../../../src/core/domain/entities/table.entity';
import { Product } from '../../../../src/core/domain/entities/product.entity';
import { MenuItem } from '../../../../src/core/domain/entities/menu-item.entity';
import { UserRole } from '@prisma/client';
import { AppError } from '../../../../src/shared/errors';

describe('CreateOrderUseCase', () => {
  let createOrderUseCase: CreateOrderUseCase;
  let mockOrderRepository: jest.Mocked<IOrderRepository>;
  let mockUserRepository: jest.Mocked<IUserRepository>;
  let mockTableRepository: jest.Mocked<ITableRepository>;
  let mockProductRepository: jest.Mocked<IProductRepository>;
  let mockMenuItemRepository: jest.Mocked<IMenuItemRepository>;
  let mockCompanyRepository: jest.Mocked<ICompanyRepository>;

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

    createOrderUseCase = new CreateOrderUseCase(
      mockOrderRepository,
      mockUserRepository,
      mockTableRepository,
      mockProductRepository,
      mockMenuItemRepository,
      mockCompanyRepository,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    const mockUser = new User(
      'user-123',
      'John',
      'Doe',
      null,
      'john@example.com',
      'hashed_password',
      null,
      true,
      UserRole.WAITER,
      new Date(),
      new Date()
    );

    const mockTable = new Table(
      'table-123',
      'Mesa 1',
      'user-123',
      true,
      true,
      new Date(),
      new Date()
    );

    const mockProduct = new Product(
      'product-123',
      'Test Product',
      'Description',
      new Date(),
      true,
      'user-123',
      new Date(),
      new Date()
    );

    const mockMenuItem = new MenuItem(
      'menu-item-123',
      'Test Menu Item',
      10.50,
      true,
      false,
      'category-123',
      'user-123',
      new Date(),
      new Date()
    );

    it('should create an order successfully with order items only', async () => {
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

      const mockOrder = new Order(
        'order-123',
        new Date(),
        false,
        1,
        23.20, // total: (10 * 2) + 16% IVA = 20 + 3.20 = 23.20
        20.00, // subtotal
        3.20, // iva
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

      const mockOrderItem = new OrderItem(
        'order-item-123',
        2,
        10.00,
        'order-123',
        'product-123',
        null,
        null,
        new Date(),
        new Date()
      );

      mockOrderRepository.create.mockResolvedValue(mockOrder);
      mockOrderRepository.createOrderItem.mockResolvedValue(mockOrderItem);
      mockOrderRepository.findOrderItemsByOrderId.mockResolvedValue([mockOrderItem]);
      mockOrderRepository.findOrderItemExtrasByOrderId.mockResolvedValue([]);

      const result = await createOrderUseCase.execute(validInput);

      expect(result).toHaveProperty('id');
      expect(result.status).toBe(false);
      expect(result.subtotal).toBe(20.00);
      expect(result.iva).toBe(3.20);
      expect(result.total).toBe(23.20);
      expect(result.orderItems).toHaveLength(1);
      expect(mockUserRepository.findById).toHaveBeenCalledWith('user-123');
      expect(mockProductRepository.findById).toHaveBeenCalledWith('product-123');
      expect(mockOrderRepository.create).toHaveBeenCalled();
      expect(mockOrderRepository.createOrderItem).toHaveBeenCalled();
    });

    it('should create an order successfully with menu items only', async () => {
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

      const mockOrder = new Order(
        'order-123',
        new Date(),
        false,
        1,
        38.64, // total: (10.50 * 3) + 16% IVA + 2 tip = 31.50 + 5.04 + 2 = 38.54
        31.50, // subtotal
        5.04, // iva
        false,
        null,
        2.00,
        'Delivery',
        null,
        false,
        null,
        'user-123',
        new Date(),
        new Date()
      );

      const mockOrderItem = new OrderItem(
        'order-item-123',
        3,
        10.50,
        'order-123',
        null,
        'menu-item-123',
        null,
        new Date(),
        new Date()
      );

      mockOrderRepository.create.mockResolvedValue(mockOrder);
      mockOrderRepository.createOrderItem.mockResolvedValue(mockOrderItem);
      mockOrderRepository.findOrderItemsByOrderId.mockResolvedValue([mockOrderItem]);
      mockOrderRepository.findOrderItemExtrasByOrderId.mockResolvedValue([]);

      const result = await createOrderUseCase.execute(validInput);

      expect(result).toHaveProperty('id');
      expect(result.origin).toBe('Delivery');
      expect(result.tip).toBe(2.00);
      expect(result.orderItems).toHaveLength(1);
      expect(mockMenuItemRepository.findById).toHaveBeenCalledWith('menu-item-123');
      expect(mockOrderRepository.createOrderItem).toHaveBeenCalled();
    });

    it('should create an order successfully with both order items and menu items', async () => {
      const validInput = {
        userId: 'user-123',
        paymentMethod: 2,
        tableId: 'table-123',
        origin: 'Local',
        orderItems: [
          { productId: 'product-123', quantity: 1, price: 10.00, extras: [] },
          { menuItemId: 'menu-item-123', quantity: 2, price: 10.50, note: 'Extra sauce', extras: [] },
        ],
        tip: 1.50,
        paymentDiffer: false,
      };

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockTableRepository.findById.mockResolvedValue(mockTable);
      mockProductRepository.findById.mockResolvedValue(mockProduct);
      mockMenuItemRepository.findById.mockResolvedValue(mockMenuItem);

      const mockOrder = new Order(
        'order-123',
        new Date(),
        false,
        2,
        37.26, // total: (10 + 21) + 16% IVA + 1.50 tip = 31 + 4.96 + 1.50 = 37.46
        31.00, // subtotal: 10 + 21
        4.96, // iva
        false,
        'table-123',
        1.50,
        'Local',
        null,
        false,
        null,
        'user-123',
        new Date(),
        new Date()
      );

      const mockOrderItemProduct = new OrderItem(
        'order-item-123',
        1,
        10.00,
        'order-123',
        'product-123',
        null,
        null,
        new Date(),
        new Date()
      );

      const mockOrderItemMenu = new OrderItem(
        'order-item-456',
        2,
        10.50,
        'order-123',
        null,
        'menu-item-123',
        'Extra sauce',
        new Date(),
        new Date()
      );

      mockOrderRepository.create.mockResolvedValue(mockOrder);
      mockOrderRepository.createOrderItem.mockResolvedValue(mockOrderItemProduct);
      mockOrderRepository.findOrderItemsByOrderId.mockResolvedValue([mockOrderItemProduct, mockOrderItemMenu]);
      mockOrderRepository.findOrderItemExtrasByOrderId.mockResolvedValue([]);

      const result = await createOrderUseCase.execute(validInput);

      expect(result).toHaveProperty('id');
      expect(result.tableId).toBe('table-123');
      expect(result.paymentMethod).toBe(2);
      expect(result.orderItems).toHaveLength(2);
      expect(mockTableRepository.findById).toHaveBeenCalledWith('table-123');
    });

    it('should throw error when user not found', async () => {
      const validInput = {
        userId: 'user-123',
        paymentMethod: 1,
        origin: 'Local',
        orderItems: [],
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
        orderItems: [],
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
