import { ExpenseType } from '@prisma/client';
import { CreateExpenseUseCase } from '../../../../src/core/application/use-cases/expenses/create-expense.use-case';
import { IExpenseRepository } from '../../../../src/core/domain/interfaces/expense-repository.interface';
import { IProductRepository } from '../../../../src/core/domain/interfaces/product-repository.interface';
import { Expense } from '../../../../src/core/domain/entities/expense.entity';
import { ExpenseItem } from '../../../../src/core/domain/entities/expense-item.entity';
import { Product } from '../../../../src/core/domain/entities/product.entity';
import { StockService } from '../../../../src/core/application/services/stock.service';
import { PrismaService } from '../../../../src/core/infrastructure/config/prisma.config';

function buildExpenseItem(id: string, productId: string, amount: number, subtotal: number, total: number) {
  return new ExpenseItem(id, 'exp-1', productId, amount, subtotal, total, 'PCS', new Date(), new Date());
}

function buildProduct(id: string) {
  return new Product(id, `Product ${id}`, null, new Date(), true, 'user-1', new Date(), new Date());
}

describe('CreateExpenseUseCase', () => {
  let useCase: CreateExpenseUseCase;
  let mockExpenseRepository: jest.Mocked<IExpenseRepository>;
  let mockProductRepository: jest.Mocked<IProductRepository>;
  let mockStockService: jest.Mocked<Pick<StockService, 'recordPurchase' | 'recordPurchaseReversal'>>;
  let mockPrismaService: jest.Mocked<PrismaService>;
  const mockTx = { __isMockTx: true } as any;

  beforeEach(() => {
    mockExpenseRepository = {
      findById: jest.fn(),
      findByPaymentId: jest.fn(),
      findAll: jest.fn(),
      findAllWithUser: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      createWithItems: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      createItem: jest.fn(),
      findItemsByExpenseId: jest.fn(),
      updateItem: jest.fn(),
      deleteItem: jest.fn(),
      deleteItemsByExpenseId: jest.fn(),
    };

    mockProductRepository = {
      findById: jest.fn(),
      findByIds: jest.fn(),
    } as any;

    mockStockService = {
      recordPurchase: jest.fn().mockResolvedValue(null),
      recordPurchaseReversal: jest.fn().mockResolvedValue(null),
    };

    mockPrismaService = {
      getClient: jest.fn().mockReturnValue({
        $transaction: jest.fn().mockImplementation((cb: Function) => cb(mockTx)),
      }),
    } as unknown as jest.Mocked<PrismaService>;

    useCase = new CreateExpenseUseCase(
      mockExpenseRepository,
      mockProductRepository,
      mockPrismaService,
      mockStockService as unknown as StockService
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('MERCHANDISE expense con 3 items', () => {
    it('crea el gasto y llama recordPurchase una vez por item con unitCost = subtotal/amount', async () => {
      const items = [
        { productId: 'prod-A', amount: 10, subtotal: 50, total: 50, unitOfMeasure: 'PCS' as const },
        { productId: 'prod-B', amount: 5, subtotal: 100, total: 110, unitOfMeasure: 'KG' as const },
        { productId: 'prod-C', amount: 2, subtotal: 30, total: 30, unitOfMeasure: 'PCS' as const },
      ];

      mockProductRepository.findByIds.mockResolvedValue([
        buildProduct('prod-A'),
        buildProduct('prod-B'),
        buildProduct('prod-C'),
      ]);

      mockExpenseRepository.createWithItems.mockResolvedValue({
        expense: new Expense(
          'exp-1', 'Compra', ExpenseType.MERCHANDISE, new Date(),
          190, 180, 10, null, 1, 'user-1', null, new Date(), new Date()
        ),
        items: [
          buildExpenseItem('ei-A', 'prod-A', 10, 50, 50),
          buildExpenseItem('ei-B', 'prod-B', 5, 100, 110),
          buildExpenseItem('ei-C', 'prod-C', 2, 30, 30),
        ],
      });

      await useCase.execute({
        title: 'Compra semanal',
        type: ExpenseType.MERCHANDISE,
        total: 190,
        subtotal: 180,
        iva: 10,
        paymentMethod: 1,
        userId: 'user-1',
        items,
      } as any);

      expect(mockStockService.recordPurchase).toHaveBeenCalledTimes(3);

      // Verifica unitCost = subtotal/amount para cada item
      expect(mockStockService.recordPurchase).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          productId: 'prod-A',
          quantity: 10,
          unitCost: 5, // 50/10
          expenseItemId: 'ei-A',
          userId: 'user-1',
        }),
        mockTx
      );
      expect(mockStockService.recordPurchase).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          productId: 'prod-B',
          quantity: 5,
          unitCost: 20, // 100/5
          expenseItemId: 'ei-B',
        }),
        mockTx
      );
      expect(mockStockService.recordPurchase).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          productId: 'prod-C',
          quantity: 2,
          unitCost: 15, // 30/2
          expenseItemId: 'ei-C',
        }),
        mockTx
      );
    });

    it('pasa la transacción tx tanto al repository como al stockService', async () => {
      mockProductRepository.findByIds.mockResolvedValue([buildProduct('prod-A')]);
      mockExpenseRepository.createWithItems.mockResolvedValue({
        expense: new Expense(
          'exp-1', 'X', ExpenseType.MERCHANDISE, new Date(),
          50, 50, 0, null, 1, 'user-1', null, new Date(), new Date()
        ),
        items: [buildExpenseItem('ei-A', 'prod-A', 10, 50, 50)],
      });

      await useCase.execute({
        title: 'X',
        type: ExpenseType.MERCHANDISE,
        total: 50,
        subtotal: 50,
        iva: 0,
        paymentMethod: 1,
        userId: 'user-1',
        items: [{ productId: 'prod-A', amount: 10, subtotal: 50, total: 50 }],
      } as any);

      expect(mockExpenseRepository.createWithItems).toHaveBeenCalledWith(expect.any(Object), mockTx);
      expect(mockStockService.recordPurchase).toHaveBeenCalledWith(expect.any(Object), mockTx);
    });
  });

  describe('Expense no-MERCHANDISE', () => {
    it('NO llama a stockService.recordPurchase', async () => {
      mockExpenseRepository.create.mockResolvedValue(
        new Expense(
          'exp-2', 'Renta', ExpenseType.RENT, new Date(),
          1000, 1000, 0, null, 2, 'user-1', null, new Date(), new Date()
        )
      );

      await useCase.execute({
        title: 'Renta',
        type: ExpenseType.RENT,
        total: 1000,
        subtotal: 1000,
        iva: 0,
        paymentMethod: 2,
        userId: 'user-1',
      } as any);

      expect(mockStockService.recordPurchase).not.toHaveBeenCalled();
      expect(mockExpenseRepository.createWithItems).not.toHaveBeenCalled();
      expect(mockExpenseRepository.create).toHaveBeenCalled();
    });
  });
});
