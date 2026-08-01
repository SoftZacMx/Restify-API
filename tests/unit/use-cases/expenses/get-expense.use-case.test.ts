import { ExpenseType } from '@prisma/client';
import { GetExpenseUseCase } from '../../../../src/core/application/use-cases/expenses/get-expense.use-case';
import { IExpenseRepository } from '../../../../src/core/domain/interfaces/expense-repository.interface';
import { Expense } from '../../../../src/core/domain/entities/expense.entity';
import { ExpenseItem } from '../../../../src/core/domain/entities/expense-item.entity';

describe('GetExpenseUseCase', () => {
  let useCase: GetExpenseUseCase;
  let mockExpenseRepository: jest.Mocked<IExpenseRepository>;

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

    useCase = new GetExpenseUseCase(mockExpenseRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('lanza EXPENSE_NOT_FOUND si el expense no existe', async () => {
    mockExpenseRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute({ expense_id: 'missing' })).rejects.toMatchObject({
      code: 'EXPENSE_NOT_FOUND',
    });
    expect(mockExpenseRepository.findItemsByExpenseId).not.toHaveBeenCalled();
  });

  it('retorna el expense con sus items cuando es MERCHANDISE', async () => {
    const createdAt = new Date('2026-01-01T10:00:00.000Z');
    const updatedAt = new Date('2026-01-02T10:00:00.000Z');
    const date = new Date('2026-01-01T00:00:00.000Z');

    mockExpenseRepository.findById.mockResolvedValue(
      new Expense(
        'exp-1', 'Compra', ExpenseType.MERCHANDISE, date,
        150, 140, 10, 'Compra semanal', 1, 'user-1', 'payment-1', createdAt, updatedAt
      )
    );
    mockExpenseRepository.findItemsByExpenseId.mockResolvedValue([
      new ExpenseItem('ei-1', 'exp-1', 'prod-1', 10, 50, 50, 'PCS', createdAt, updatedAt),
      new ExpenseItem('ei-2', 'exp-1', 'prod-2', 5, 90, 100, null, createdAt, updatedAt),
    ]);

    const result = await useCase.execute({ expense_id: 'exp-1' });

    expect(mockExpenseRepository.findItemsByExpenseId).toHaveBeenCalledWith('exp-1');
    expect(result).toEqual({
      id: 'exp-1',
      title: 'Compra',
      type: ExpenseType.MERCHANDISE,
      date,
      total: 150,
      subtotal: 140,
      iva: 10,
      description: 'Compra semanal',
      paymentMethod: 1,
      userId: 'user-1',
      paymentId: 'payment-1',
      createdAt,
      updatedAt,
      items: [
        { id: 'ei-1', productId: 'prod-1', amount: 10, subtotal: 50, total: 50, unitOfMeasure: 'PCS' },
        { id: 'ei-2', productId: 'prod-2', amount: 5, subtotal: 90, total: 100, unitOfMeasure: null },
      ],
    });
  });

  it('retorna items vacíos cuando el expense NO es MERCHANDISE', async () => {
    mockExpenseRepository.findById.mockResolvedValue(
      new Expense(
        'exp-2', 'Renta', ExpenseType.RENT, new Date('2026-01-01'),
        1000, 1000, 0, null, 2, 'user-1', null, new Date(), new Date()
      )
    );

    const result = await useCase.execute({ expense_id: 'exp-2' });

    expect(mockExpenseRepository.findItemsByExpenseId).not.toHaveBeenCalled();
    expect(result.items).toEqual([]);
    expect(result.type).toBe(ExpenseType.RENT);
  });
});
