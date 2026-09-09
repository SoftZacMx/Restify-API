import { ExpenseType } from '@prisma/client';
import { DeleteExpenseUseCase } from '../../../../src/core/application/use-cases/expenses/delete-expense.use-case';
import { IExpenseRepository } from '../../../../src/core/domain/interfaces/expense-repository.interface';
import { Expense } from '../../../../src/core/domain/entities/expense.entity';
import { ExpenseItem } from '../../../../src/core/domain/entities/expense-item.entity';
import { StockService } from '../../../../src/core/application/services/stock.service';
import { getPrisma } from '../../../../src/core/infrastructure/database/prisma/get-prisma';
import { AppError } from '../../../../src/shared/errors';

jest.mock('../../../../src/core/infrastructure/database/prisma/get-prisma');
const mockGetPrisma = getPrisma as jest.MockedFunction<typeof getPrisma>;

function buildExpenseItem(id: string, productId: string) {
  return new ExpenseItem(id, 'exp-1', productId, 10, 50, 50, 'PCS', new Date(), new Date());
}

describe('DeleteExpenseUseCase', () => {
  let useCase: DeleteExpenseUseCase;
  let mockExpenseRepository: jest.Mocked<IExpenseRepository>;
  let mockStockService: jest.Mocked<Pick<StockService, 'recordPurchase' | 'recordPurchaseReversal'>>;
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
      delete: jest.fn().mockResolvedValue(undefined),
      createItem: jest.fn(),
      findItemsByExpenseId: jest.fn(),
      updateItem: jest.fn(),
      deleteItem: jest.fn(),
      deleteItemsByExpenseId: jest.fn(),
    };

    mockStockService = {
      recordPurchase: jest.fn(),
      recordPurchaseReversal: jest.fn().mockResolvedValue(null),
    };

    mockGetPrisma.mockReturnValue({
      $transaction: jest.fn().mockImplementation((cb: Function) => cb(mockTx)),
    } as any);

    useCase = new DeleteExpenseUseCase(
      mockExpenseRepository,
      mockStockService as unknown as StockService
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('lanza EXPENSE_NOT_FOUND si el expense no existe', async () => {
    mockExpenseRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute({ expense_id: 'missing', userId: 'user-1' })).rejects.toMatchObject({
      code: 'EXPENSE_NOT_FOUND',
    });
    expect(mockStockService.recordPurchaseReversal).not.toHaveBeenCalled();
    expect(mockExpenseRepository.delete).not.toHaveBeenCalled();
  });

  describe('Expense MERCHANDISE con items', () => {
    beforeEach(() => {
      mockExpenseRepository.findById.mockResolvedValue(
        new Expense(
          'exp-1', 'Compra', ExpenseType.MERCHANDISE, new Date(),
          150, 150, 0, null, 1, 'user-1', null, new Date(), new Date()
        )
      );
      mockExpenseRepository.findItemsByExpenseId.mockResolvedValue([
        buildExpenseItem('ei-A', 'prod-A'),
        buildExpenseItem('ei-B', 'prod-B'),
        buildExpenseItem('ei-C', 'prod-C'),
      ]);
    });

    it('llama recordPurchaseReversal una vez por item con reason "expense deleted" antes del delete', async () => {
      await useCase.execute({ expense_id: 'exp-1', userId: 'user-1' });

      expect(mockStockService.recordPurchaseReversal).toHaveBeenCalledTimes(3);

      expect(mockStockService.recordPurchaseReversal).toHaveBeenNthCalledWith(
        1,
        { expenseItemId: 'ei-A', reason: 'expense deleted', userId: 'user-1' },
        mockTx
      );
      expect(mockStockService.recordPurchaseReversal).toHaveBeenNthCalledWith(
        2,
        { expenseItemId: 'ei-B', reason: 'expense deleted', userId: 'user-1' },
        mockTx
      );
      expect(mockStockService.recordPurchaseReversal).toHaveBeenNthCalledWith(
        3,
        { expenseItemId: 'ei-C', reason: 'expense deleted', userId: 'user-1' },
        mockTx
      );

      expect(mockExpenseRepository.delete).toHaveBeenCalledWith('exp-1', mockTx);
    });

    it('reversals y delete corren con la misma transacción', async () => {
      await useCase.execute({ expense_id: 'exp-1', userId: 'user-1' });

      const allCalls = [
        ...mockStockService.recordPurchaseReversal.mock.calls.map((c) => c[1]),
        mockExpenseRepository.delete.mock.calls[0][1],
      ];
      // Todas las llamadas reciben exactamente la misma instancia tx
      allCalls.forEach((tx) => expect(tx).toBe(mockTx));
    });
  });

  describe('Expense no-MERCHANDISE (sin items)', () => {
    it('borra el expense sin generar reversals', async () => {
      mockExpenseRepository.findById.mockResolvedValue(
        new Expense(
          'exp-2', 'Renta', ExpenseType.RENT, new Date(),
          1000, 1000, 0, null, 2, 'user-1', null, new Date(), new Date()
        )
      );
      mockExpenseRepository.findItemsByExpenseId.mockResolvedValue([]);

      await useCase.execute({ expense_id: 'exp-2', userId: 'user-1' });

      expect(mockStockService.recordPurchaseReversal).not.toHaveBeenCalled();
      expect(mockExpenseRepository.delete).toHaveBeenCalledWith('exp-2', mockTx);
    });
  });
});
