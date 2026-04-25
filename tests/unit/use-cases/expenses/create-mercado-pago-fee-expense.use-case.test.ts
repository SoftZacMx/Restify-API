import { CreateMercadoPagoFeeExpenseUseCase } from '../../../../src/core/application/use-cases/expenses/create-mercado-pago-fee-expense.use-case';
import { IExpenseRepository } from '../../../../src/core/domain/interfaces/expense-repository.interface';
import { Expense } from '../../../../src/core/domain/entities/expense.entity';
import { ExpenseType } from '@prisma/client';

describe('CreateMercadoPagoFeeExpenseUseCase', () => {
  let useCase: CreateMercadoPagoFeeExpenseUseCase;
  let mockExpenseRepository: jest.Mocked<IExpenseRepository>;

  const paymentId = 'payment-uuid-123';
  const orderId = 'order-uuid-456';
  const mpPaymentId = 99999;

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

    useCase = new CreateMercadoPagoFeeExpenseUseCase(mockExpenseRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('happy path', () => {
    it('creates an expense with type MERCADO_PAGO_FEE, paymentMethod=2, userId=null', async () => {
      mockExpenseRepository.findByPaymentId.mockResolvedValue(null);
      const createdExpense = new Expense(
        'expense-id-1', 'Comisión Mercado Pago - Orden order-uuid-456',
        ExpenseType.MERCADO_PAGO_FEE, new Date('2026-04-24'),
        6.35, 6.35, 0, 'desc', 2, null, paymentId, new Date(), new Date()
      );
      mockExpenseRepository.create.mockResolvedValue(createdExpense);

      const result = await useCase.execute({
        paymentId,
        orderId,
        mpPaymentId,
        feeAmount: 6.35,
        date: new Date('2026-04-24T12:00:00.000Z'),
      });

      expect(result.created).toBe(true);
      expect(result.expenseId).toBe('expense-id-1');
      expect(mockExpenseRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ExpenseType.MERCADO_PAGO_FEE,
          paymentMethod: 2,
          userId: null,
          paymentId,
          total: 6.35,
          subtotal: 6.35,
          iva: 0,
        })
      );
      expect(mockExpenseRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining(orderId),
        })
      );
    });

    it('uses now() for date when no date is provided', async () => {
      mockExpenseRepository.findByPaymentId.mockResolvedValue(null);
      mockExpenseRepository.create.mockResolvedValue(
        new Expense('e1', 't', ExpenseType.MERCADO_PAGO_FEE, new Date(), 1, 1, 0, null, 2, null, paymentId, new Date(), new Date())
      );

      const before = Date.now();
      await useCase.execute({ paymentId, orderId, mpPaymentId, feeAmount: 1.0 });
      const after = Date.now();

      const call = mockExpenseRepository.create.mock.calls[0][0];
      const usedDate = call.date.getTime();
      expect(usedDate).toBeGreaterThanOrEqual(before);
      expect(usedDate).toBeLessThanOrEqual(after);
    });
  });

  describe('idempotency', () => {
    it('returns existing expense without creating a new one when paymentId already has an expense', async () => {
      const existingExpense = new Expense(
        'existing-expense-id', 'Comisión Mercado Pago',
        ExpenseType.MERCADO_PAGO_FEE, new Date(),
        6.35, 6.35, 0, null, 2, null, paymentId, new Date(), new Date()
      );
      mockExpenseRepository.findByPaymentId.mockResolvedValue(existingExpense);

      const result = await useCase.execute({
        paymentId,
        orderId,
        mpPaymentId,
        feeAmount: 6.35,
      });

      expect(result.created).toBe(false);
      expect(result.expenseId).toBe('existing-expense-id');
      expect(mockExpenseRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('skip cases', () => {
    it('returns created=false without calling repository when feeAmount is 0', async () => {
      const result = await useCase.execute({
        paymentId,
        orderId,
        mpPaymentId,
        feeAmount: 0,
      });

      expect(result.created).toBe(false);
      expect(result.expenseId).toBeNull();
      expect(mockExpenseRepository.findByPaymentId).not.toHaveBeenCalled();
      expect(mockExpenseRepository.create).not.toHaveBeenCalled();
    });

    it('returns created=false without calling repository when feeAmount is negative', async () => {
      const result = await useCase.execute({
        paymentId,
        orderId,
        mpPaymentId,
        feeAmount: -1.5,
      });

      expect(result.created).toBe(false);
      expect(mockExpenseRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('orderId optional', () => {
    it('creates an expense even when orderId is null (title omits the order ref)', async () => {
      mockExpenseRepository.findByPaymentId.mockResolvedValue(null);
      mockExpenseRepository.create.mockResolvedValue(
        new Expense('e1', 'Comisión Mercado Pago', ExpenseType.MERCADO_PAGO_FEE, new Date(), 5, 5, 0, null, 2, null, paymentId, new Date(), new Date())
      );

      await useCase.execute({
        paymentId,
        orderId: null,
        mpPaymentId,
        feeAmount: 5,
      });

      const call = mockExpenseRepository.create.mock.calls[0][0];
      expect(call.title).not.toContain('Orden');
    });
  });
});
