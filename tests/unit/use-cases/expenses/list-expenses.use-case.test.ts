import { ExpenseType } from '@prisma/client';
import { ListExpensesUseCase } from '../../../../src/core/application/use-cases/expenses/list-expenses.use-case';
import { IExpenseRepository, ExpenseWithUser } from '../../../../src/core/domain/interfaces/expense-repository.interface';
import { BranchTimezoneService } from '../../../../src/core/application/services/branch-timezone.service';

function buildExpenseWithUser(overrides: Partial<ExpenseWithUser> = {}): ExpenseWithUser {
  return {
    id: 'exp-1',
    title: 'Compra',
    type: ExpenseType.MERCHANDISE,
    date: new Date('2026-01-01T00:00:00.000Z'),
    total: 150,
    subtotal: 140,
    iva: 10,
    description: null,
    paymentMethod: 1,
    userId: 'user-1',
    paymentId: null,
    createdAt: new Date('2026-01-01T10:00:00.000Z'),
    updatedAt: new Date('2026-01-01T10:00:00.000Z'),
    user: null,
    ...overrides,
  };
}

describe('ListExpensesUseCase', () => {
  let useCase: ListExpensesUseCase;
  let mockExpenseRepository: jest.Mocked<IExpenseRepository>;
  let mockBranchTimezoneService: jest.Mocked<Pick<BranchTimezoneService, 'get'>>;

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

    useCase = new ListExpensesUseCase(
      mockExpenseRepository,
      mockBranchTimezoneService as unknown as BranchTimezoneService
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('sin input usa filtros/paginación por defecto y userName "Sistema" si no hay usuario', async () => {
    mockExpenseRepository.findAllWithUser.mockResolvedValue([buildExpenseWithUser()]);
    mockExpenseRepository.count.mockResolvedValue(41);

    const result = await useCase.execute();

    expect(mockBranchTimezoneService.get).toHaveBeenCalled();
    expect(mockExpenseRepository.findAllWithUser).toHaveBeenCalledWith(undefined, { skip: 0, take: 20 });
    expect(mockExpenseRepository.count).toHaveBeenCalledWith(undefined);
    expect(result.data[0].userName).toBe('Sistema');
    expect(result.pagination).toEqual({ page: 1, pageSize: 20, total: 41, totalPages: 3 });
  });

  it('con input completo construye filtros, aplica page/pageSize y arma el nombre completo', async () => {
    const fullUser = { name: 'Juan', last_name: 'Perez', second_last_name: 'Garcia' };
    mockExpenseRepository.findAllWithUser.mockResolvedValue([
      buildExpenseWithUser({ userId: 'user-2', user: fullUser }),
    ]);
    mockExpenseRepository.count.mockResolvedValue(60);

    const result = await useCase.execute({
      type: ExpenseType.UTILITY,
      userId: 'user-2',
      paymentMethod: 2,
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
      page: 2,
      pageSize: 50,
    });

    expect(mockExpenseRepository.findAllWithUser).toHaveBeenCalledWith(
      expect.objectContaining({
        type: ExpenseType.UTILITY,
        userId: 'user-2',
        paymentMethod: 2,
        dateFrom: new Date('2026-01-01T06:00:00.000Z'),
        dateTo: new Date('2026-02-01T05:59:59.999Z'),
      }),
      { skip: 50, take: 50 }
    );
    expect(mockExpenseRepository.count).toHaveBeenCalledWith(
      expect.objectContaining({ type: ExpenseType.UTILITY })
    );
    expect(result.data[0].userName).toBe('Juan Perez Garcia');
    expect(result.pagination).toEqual({ page: 2, pageSize: 50, total: 60, totalPages: 2 });
  });

  it('sin dateFrom/dateTo y sin page/pageSize omite los filtros de fecha y usa defaults', async () => {
    mockExpenseRepository.findAllWithUser.mockResolvedValue([
      buildExpenseWithUser({ user: { name: 'Maria', last_name: 'Lopez', second_last_name: null } }),
    ]);
    mockExpenseRepository.count.mockResolvedValue(5);

    const result = await useCase.execute({ type: ExpenseType.RENT });

    const [, pagination] = mockExpenseRepository.findAllWithUser.mock.calls[0];
    expect(pagination).toEqual({ skip: 0, take: 20 });
    expect(mockExpenseRepository.findAllWithUser).toHaveBeenCalledWith(
      expect.objectContaining({
        dateFrom: undefined,
        dateTo: undefined,
      }),
      { skip: 0, take: 20 }
    );
    expect(result.data[0].userName).toBe('Maria Lopez');
    expect(result.pagination.page).toBe(1);
    expect(result.pagination.pageSize).toBe(20);
  });

  it('topea el pageSize a 100 y recalcula totalPages', async () => {
    mockExpenseRepository.findAllWithUser.mockResolvedValue([buildExpenseWithUser()]);
    mockExpenseRepository.count.mockResolvedValue(250);

    const result = await useCase.execute({ page: 1, pageSize: 250 });

    expect(mockExpenseRepository.findAllWithUser).toHaveBeenCalledWith(
      expect.objectContaining({ type: undefined, userId: undefined, paymentMethod: undefined }),
      { skip: 0, take: 100 }
    );
    expect(result.pagination).toEqual({ page: 1, pageSize: 100, total: 250, totalPages: 3 });
  });
});
