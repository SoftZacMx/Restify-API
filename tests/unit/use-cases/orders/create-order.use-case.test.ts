import { CreateOrderUseCase } from '../../../../src/core/application/use-cases/orders/create-order.use-case';
import { IOrderRepository } from '../../../../src/core/domain/interfaces/order-repository.interface';
import { IUserRepository } from '../../../../src/core/domain/interfaces/user-repository.interface';
import { ITableRepository } from '../../../../src/core/domain/interfaces/table-repository.interface';
import { IProductRepository } from '../../../../src/core/domain/interfaces/product-repository.interface';
import { IMenuItemRepository } from '../../../../src/core/domain/interfaces/menu-item-repository.interface';
import { Order } from '../../../../src/core/domain/entities/order.entity';
import { OrderItem } from '../../../../src/core/domain/entities/order-item.entity';
import { OrderMenuItem } from '../../../../src/core/domain/entities/order-menu-item.entity';
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

    mockUserRepository = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findAll: jest.fn(),
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
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    mockMenuItemRepository = {
      findById: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    createOrderUseCase = new CreateOrderUseCase(
      mockOrderRepository,
      mockUserRepository,
      mockTableRepository,
      mockProductRepository,
      mockMenuItemRepository
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
      1,
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
          {
            productId: 'product-123',
            quantity: 2,
            price: 10.00,
          },
        ],
        orderMenuItems: [],
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
        new Date(),
        new Date()
      );

      mockOrderRepository.create.mockResolvedValue(mockOrder);
      mockOrderRepository.createOrderItem.mockResolvedValue(mockOrderItem);
      mockOrderRepository.findOrderItemsByOrderId.mockResolvedValue([mockOrderItem]);
      mockOrderRepository.findOrderMenuItemsByOrderId.mockResolvedValue([]);

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
        orderItems: [],
        orderMenuItems: [
          {
            menuItemId: 'menu-item-123',
            amount: 3,
            unitPrice: 10.50,
            note: null,
          },
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

      const mockOrderMenuItem = new OrderMenuItem(
        'order-menu-item-123',
        'order-123',
        'menu-item-123',
        3,
        10.50,
        null,
        new Date(),
        new Date()
      );

      mockOrderRepository.create.mockResolvedValue(mockOrder);
      mockOrderRepository.createOrderMenuItem.mockResolvedValue(mockOrderMenuItem);
      mockOrderRepository.findOrderItemsByOrderId.mockResolvedValue([]);
      mockOrderRepository.findOrderMenuItemsByOrderId.mockResolvedValue([mockOrderMenuItem]);

      const result = await createOrderUseCase.execute(validInput);

      expect(result).toHaveProperty('id');
      expect(result.origin).toBe('Delivery');
      expect(result.tip).toBe(2.00);
      expect(result.orderMenuItems).toHaveLength(1);
      expect(mockMenuItemRepository.findById).toHaveBeenCalledWith('menu-item-123');
      expect(mockOrderRepository.createOrderMenuItem).toHaveBeenCalled();
    });

    it('should create an order successfully with both order items and menu items', async () => {
      const validInput = {
        userId: 'user-123',
        paymentMethod: 2,
        tableId: 'table-123',
        origin: 'Local',
        orderItems: [
          {
            productId: 'product-123',
            quantity: 1,
            price: 10.00,
          },
        ],
        orderMenuItems: [
          {
            menuItemId: 'menu-item-123',
            amount: 2,
            unitPrice: 10.50,
            note: 'Extra sauce',
          },
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

      const mockOrderItem = new OrderItem(
        'order-item-123',
        1,
        10.00,
        'order-123',
        'product-123',
        new Date(),
        new Date()
      );

      const mockOrderMenuItem = new OrderMenuItem(
        'order-menu-item-123',
        'order-123',
        'menu-item-123',
        2,
        10.50,
        'Extra sauce',
        new Date(),
        new Date()
      );

      mockOrderRepository.create.mockResolvedValue(mockOrder);
      mockOrderRepository.createOrderItem.mockResolvedValue(mockOrderItem);
      mockOrderRepository.createOrderMenuItem.mockResolvedValue(mockOrderMenuItem);
      mockOrderRepository.findOrderItemsByOrderId.mockResolvedValue([mockOrderItem]);
      mockOrderRepository.findOrderMenuItemsByOrderId.mockResolvedValue([mockOrderMenuItem]);

      const result = await createOrderUseCase.execute(validInput);

      expect(result).toHaveProperty('id');
      expect(result.tableId).toBe('table-123');
      expect(result.paymentMethod).toBe(2);
      expect(result.orderItems).toHaveLength(1);
      expect(result.orderMenuItems).toHaveLength(1);
      expect(mockTableRepository.findById).toHaveBeenCalledWith('table-123');
    });

    it('should throw error when user not found', async () => {
      const validInput = {
        userId: 'user-123',
        paymentMethod: 1,
        origin: 'Local',
        orderItems: [],
        orderMenuItems: [],
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
        orderMenuItems: [],
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
          {
            productId: 'product-123',
            quantity: 1,
            price: 10.00,
          },
        ],
        orderMenuItems: [],
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
        orderItems: [],
        orderMenuItems: [
          {
            menuItemId: 'menu-item-123',
            amount: 1,
            unitPrice: 10.50,
            note: null,
          },
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

