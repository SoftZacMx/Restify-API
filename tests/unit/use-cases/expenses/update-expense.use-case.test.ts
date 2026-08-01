import { ExpenseType } from '@prisma/client';
import { UpdateExpenseUseCase } from '../../../../src/core/application/use-cases/expenses/update-expense.use-case';
import { IExpenseRepository } from '../../../../src/core/domain/interfaces/expense-repository.interface';
import { BranchTimezoneService } from '../../../../src/core/application/services/branch-timezone.service';
import { Expense } from '../../../../src/core/domain/entities/expense.entity';

describe('UpdateExpenseUseCase', () => {
  let useCase: UpdateExpenseUseCase;
  let mockExpenseRepository: jest.Mocked<IExpenseRepository>;
  let mockBranchTimezoneService: jest.Mocked<Pick<BranchTimezoneService, 'get'>>;

  const existingExpense = new Expense(
    'exp-1', 'Compra', ExpenseType.MERCHANDISE, new Date('2026-01-01T00:00:00.000Z'),
    150, 140, 10, 'Desc', 1, 'user-1', null, new Date(), new Date()
  );

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

    mockBranchTimezoneService = {
      get: jest.fn().mockResolvedValue('America/Mexico_City'),
    };

    mockExpenseRepository.findById.mockResolvedValue(existingExpense);
    mockExpenseRepository.update.mockResolvedValue(existingExpense);

    useCase = new UpdateExpenseUseCase(
      mockExpenseRepository,
      mockBranchTimezoneService as unknown as BranchTimezoneService
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('lanza EXPENSE_NOT_FOUND si el expense no existe', async () => {
    mockExpenseRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute('missing', { title: 'X' })).rejects.toMatchObject({
      code: 'EXPENSE_NOT_FOUND',
    });
    expect(mockExpenseRepository.update).not.toHaveBeenCalled();
  });

  it('construye el updateData con todos los campos y convierte la fecha a la zona de la sucursal', async () => {
    const updatedExpense = new Expense(
      'exp-1', 'Compra nueva', ExpenseType.MERCHANDISE, new Date('2026-02-15T06:00:00.000Z'),
      200, 180, 20, 'Nueva desc', 2, 'user-1', null, new Date(), new Date()
    );
    mockExpenseRepository.update.mockResolvedValue(updatedExpense);

    const result = await useCase.execute('exp-1', {
      title: 'Compra nueva',
      date: '2026-02-15',
      total: 200,
      subtotal: 180,
      iva: 20,
      description: 'Nueva desc',
      paymentMethod: 2,
    });

    expect(mockBranchTimezoneService.get).toHaveBeenCalled();
    expect(mockExpenseRepository.update).toHaveBeenCalledWith(
      'exp-1',
      {
        title: 'Compra nueva',
        date: new Date('2026-02-15T06:00:00.000Z'),
        total: 200,
        subtotal: 180,
        iva: 20,
        description: 'Nueva desc',
        paymentMethod: 2,
      }
    );
    expect(result).toEqual({
      id: 'exp-1',
      title: 'Compra nueva',
      type: ExpenseType.MERCHANDISE,
      date: new Date('2026-02-15T06:00:00.000Z'),
      total: 200,
      subtotal: 180,
      iva: 20,
      description: 'Nueva desc',
      paymentMethod: 2,
      userId: 'user-1',
      paymentId: null,
      updatedAt: updatedExpense.updatedAt,
    });
  });

  it('no toca el updateData cuando el input no trae campos opcionales', async () => {
    const result = await useCase.execute('exp-1', {});

    expect(mockExpenseRepository.update).toHaveBeenCalledWith('exp-1', {});
    expect(result.id).toBe('exp-1');
  });
});
