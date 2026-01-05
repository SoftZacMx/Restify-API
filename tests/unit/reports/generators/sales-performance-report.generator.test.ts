import { SalesPerformanceReportGenerator } from '../../../../src/core/application/reports/generators/sales-performance-report.generator';
import { IOrderRepository } from '../../../../src/core/domain/interfaces/order-repository.interface';
import { IMenuItemRepository } from '../../../../src/core/domain/interfaces/menu-item-repository.interface';
import { PrismaService } from '../../../../src/core/infrastructure/config/prisma.config';
import { ReportType } from '../../../../src/core/domain/interfaces/report-generator.interface';
import { MenuItem } from '../../../../src/core/domain/entities/menu-item.entity';

// Mock Prisma Client
const mockPrismaClient = {
  orderMenuItem: {
    findMany: jest.fn(),
  },
};

// Mock PrismaService
jest.mock('../../../../src/core/infrastructure/config/prisma.config', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({
    getClient: () => mockPrismaClient,
  })),
}));

describe('SalesPerformanceReportGenerator', () => {
  let generator: SalesPerformanceReportGenerator;
  let mockOrderRepository: jest.Mocked<IOrderRepository>;
  let mockMenuItemRepository: jest.Mocked<IMenuItemRepository>;
  let mockPrismaService: jest.Mocked<PrismaService>;

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

    mockMenuItemRepository = {
      findById: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    mockPrismaService = new PrismaService() as any;

    generator = new SalesPerformanceReportGenerator(
      mockOrderRepository,
      mockMenuItemRepository,
      mockPrismaService
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getType', () => {
    it('should return SALES_PERFORMANCE type', () => {
      expect(generator.getType()).toBe(ReportType.SALES_PERFORMANCE);
    });
  });

  describe('generate', () => {
    const baseFilters = {
      dateFrom: new Date('2024-01-01'),
      dateTo: new Date('2024-01-31'),
    };

    it('should generate sales performance report successfully', async () => {
      // Mock order menu items
      const mockOrderMenuItems = [
        {
          id: 'omi-1',
          orderId: 'order-1',
          menuItemId: 'menu-1',
          amount: 2,
          unitPrice: 15.0,
          note: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          menuItem: {
            id: 'menu-1',
            name: 'Burger',
            price: 15.0,
            status: true,
            categoryId: 'cat-1',
            userId: 'user-1',
            createdAt: new Date(),
            updatedAt: new Date(),
            category: {
              id: 'cat-1',
              name: 'Main Course',
            },
          },
          order: {
            id: 'order-1',
            date: new Date('2024-01-15'),
            status: true,
          },
        },
        {
          id: 'omi-2',
          orderId: 'order-2',
          menuItemId: 'menu-1',
          amount: 3,
          unitPrice: 15.0,
          note: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          menuItem: {
            id: 'menu-1',
            name: 'Burger',
            price: 15.0,
            status: true,
            categoryId: 'cat-1',
            userId: 'user-1',
            createdAt: new Date(),
            updatedAt: new Date(),
            category: {
              id: 'cat-1',
              name: 'Main Course',
            },
          },
          order: {
            id: 'order-2',
            date: new Date('2024-01-20'),
            status: true,
          },
        },
        {
          id: 'omi-3',
          orderId: 'order-3',
          menuItemId: 'menu-2',
          amount: 1,
          unitPrice: 25.0,
          note: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          menuItem: {
            id: 'menu-2',
            name: 'Pizza',
            price: 25.0,
            status: true,
            categoryId: 'cat-1',
            userId: 'user-1',
            createdAt: new Date(),
            updatedAt: new Date(),
            category: {
              id: 'cat-1',
              name: 'Main Course',
            },
          },
          order: {
            id: 'order-3',
            date: new Date('2024-01-25'),
            status: true,
          },
        },
      ];

      const mockMenuItems = [
        new MenuItem('menu-1', 'Burger', 15.0, true, 'cat-1', 'user-1', new Date(), new Date()),
        new MenuItem('menu-2', 'Pizza', 25.0, true, 'cat-1', 'user-1', new Date(), new Date()),
      ];

      mockPrismaClient.orderMenuItem.findMany.mockResolvedValue(mockOrderMenuItems as any);
      mockMenuItemRepository.findAll.mockResolvedValue(mockMenuItems);

      const result = await generator.generate(baseFilters);

      expect(result.type).toBe(ReportType.SALES_PERFORMANCE);
      expect(result.data).toBeDefined();
      expect(result.data.sales).toHaveLength(2);
      expect(result.data.totalSold).toBe(100); // (2+3)*15 + 1*25 = 75 + 25 = 100

      // Check Burger sales
      const burgerSale = result.data.sales.find((s) => s.menuItemId === 'menu-1');
      expect(burgerSale).toBeDefined();
      expect(burgerSale?.quantitySold).toBe(5); // 2 + 3
      expect(burgerSale?.totalSold).toBe(75); // 5 * 15

      // Check Pizza sales
      const pizzaSale = result.data.sales.find((s) => s.menuItemId === 'menu-2');
      expect(pizzaSale).toBeDefined();
      expect(pizzaSale?.quantitySold).toBe(1);
      expect(pizzaSale?.totalSold).toBe(25);
    });

    it('should calculate percentages correctly', async () => {
      const mockOrderMenuItems = [
        {
          id: 'omi-1',
          orderId: 'order-1',
          menuItemId: 'menu-1',
          amount: 2,
          unitPrice: 10.0,
          note: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          menuItem: {
            id: 'menu-1',
            name: 'Item 1',
            price: 10.0,
            status: true,
            categoryId: 'cat-1',
            userId: 'user-1',
            createdAt: new Date(),
            updatedAt: new Date(),
            category: { id: 'cat-1', name: 'Category' },
          },
          order: { id: 'order-1', date: new Date(), status: true },
        },
        {
          id: 'omi-2',
          orderId: 'order-2',
          menuItemId: 'menu-2',
          amount: 1,
          unitPrice: 30.0,
          note: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          menuItem: {
            id: 'menu-2',
            name: 'Item 2',
            price: 30.0,
            status: true,
            categoryId: 'cat-1',
            userId: 'user-1',
            createdAt: new Date(),
            updatedAt: new Date(),
            category: { id: 'cat-1', name: 'Category' },
          },
          order: { id: 'order-2', date: new Date(), status: true },
        },
      ];

      const mockMenuItems = [
        new MenuItem('menu-1', 'Item 1', 10.0, true, 'cat-1', 'user-1', new Date(), new Date()),
        new MenuItem('menu-2', 'Item 2', 30.0, true, 'cat-1', 'user-1', new Date(), new Date()),
      ];

      mockPrismaClient.orderMenuItem.findMany.mockResolvedValue(mockOrderMenuItems as any);
      mockMenuItemRepository.findAll.mockResolvedValue(mockMenuItems);

      const result = await generator.generate(baseFilters);

      // Total: 2*10 + 1*30 = 50
      // Item 1: 20 (40%), Item 2: 30 (60%)
      const item1 = result.data.sales.find((s) => s.menuItemId === 'menu-1');
      const item2 = result.data.sales.find((s) => s.menuItemId === 'menu-2');

      expect(item1?.percentageOfTotal).toBeCloseTo(40, 1);
      expect(item2?.percentageOfTotal).toBeCloseTo(60, 1);
    });

    it('should identify top seller correctly', async () => {
      const mockOrderMenuItems = [
        {
          id: 'omi-1',
          orderId: 'order-1',
          menuItemId: 'menu-1',
          amount: 5,
          unitPrice: 10.0,
          note: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          menuItem: {
            id: 'menu-1',
            name: 'Top Seller',
            price: 10.0,
            status: true,
            categoryId: 'cat-1',
            userId: 'user-1',
            createdAt: new Date(),
            updatedAt: new Date(),
            category: { id: 'cat-1', name: 'Category' },
          },
          order: { id: 'order-1', date: new Date(), status: true },
        },
        {
          id: 'omi-2',
          orderId: 'order-2',
          menuItemId: 'menu-2',
          amount: 1,
          unitPrice: 20.0,
          note: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          menuItem: {
            id: 'menu-2',
            name: 'Other Item',
            price: 20.0,
            status: true,
            categoryId: 'cat-1',
            userId: 'user-1',
            createdAt: new Date(),
            updatedAt: new Date(),
            category: { id: 'cat-1', name: 'Category' },
          },
          order: { id: 'order-2', date: new Date(), status: true },
        },
      ];

      const mockMenuItems = [
        new MenuItem('menu-1', 'Top Seller', 10.0, true, 'cat-1', 'user-1', new Date(), new Date()),
        new MenuItem('menu-2', 'Other Item', 20.0, true, 'cat-1', 'user-1', new Date(), new Date()),
      ];

      mockPrismaClient.orderMenuItem.findMany.mockResolvedValue(mockOrderMenuItems as any);
      mockMenuItemRepository.findAll.mockResolvedValue(mockMenuItems);

      const result = await generator.generate(baseFilters);

      expect(result.data.summary.topSeller).toBeDefined();
      expect(result.data.summary.topSeller?.menuItemId).toBe('menu-1');
      expect(result.data.summary.topSeller?.menuItemName).toBe('Top Seller');
      expect(result.data.summary.topSeller?.totalSold).toBe(50); // 5 * 10
    });

    it('should handle empty data correctly', async () => {
      mockPrismaClient.orderMenuItem.findMany.mockResolvedValue([]);
      mockMenuItemRepository.findAll.mockResolvedValue([]);

      const result = await generator.generate(baseFilters);

      expect(result.data.sales).toHaveLength(0);
      expect(result.data.totalSold).toBe(0);
      expect(result.data.summary.topSeller).toBeNull();
    });
  });
});

