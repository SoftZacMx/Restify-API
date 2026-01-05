import { UpdateEmployeeSalaryPaymentUseCase } from '../../../../src/core/application/use-cases/employee-salary-payments/update-employee-salary-payment.use-case';
import { IEmployeeSalaryPaymentRepository } from '../../../../src/core/domain/interfaces/employee-salary-payment-repository.interface';
import { EmployeeSalaryPayment } from '../../../../src/core/domain/entities/employee-salary-payment.entity';
import { AppError } from '../../../../src/shared/errors';

describe('UpdateEmployeeSalaryPaymentUseCase', () => {
  let updateEmployeeSalaryPaymentUseCase: UpdateEmployeeSalaryPaymentUseCase;
  let mockEmployeeSalaryPaymentRepository: jest.Mocked<IEmployeeSalaryPaymentRepository>;

  beforeEach(() => {
    mockEmployeeSalaryPaymentRepository = {
      findById: jest.fn(),
      findAll: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    updateEmployeeSalaryPaymentUseCase = new UpdateEmployeeSalaryPaymentUseCase(
      mockEmployeeSalaryPaymentRepository
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    const paymentId = 'payment-123';
    const updateInput = {
      amount: 6000.0,
      paymentMethod: 2,
    };

    it('should update payment successfully', async () => {
      const existingPayment = new EmployeeSalaryPayment(
        'payment-123',
        'user-123',
        5000.0,
        1,
        new Date('2024-01-15'),
        new Date(),
        new Date()
      );

      const updatedPayment = new EmployeeSalaryPayment(
        'payment-123',
        'user-123',
        6000.0,
        2,
        new Date('2024-01-15'),
        new Date(),
        new Date()
      );

      mockEmployeeSalaryPaymentRepository.findById.mockResolvedValue(
        existingPayment
      );
      mockEmployeeSalaryPaymentRepository.update.mockResolvedValue(
        updatedPayment
      );

      const result = await updateEmployeeSalaryPaymentUseCase.execute(
        paymentId,
        updateInput
      );

      expect(result.amount).toBe(6000.0);
      expect(result.paymentMethod).toBe(2);
      expect(
        mockEmployeeSalaryPaymentRepository.findById
      ).toHaveBeenCalledWith(paymentId);
      expect(
        mockEmployeeSalaryPaymentRepository.update
      ).toHaveBeenCalledWith(paymentId, {
        amount: 6000.0,
        paymentMethod: 2,
      });
    });

    it('should throw error when payment not found', async () => {
      mockEmployeeSalaryPaymentRepository.findById.mockResolvedValue(null);

      try {
        await updateEmployeeSalaryPaymentUseCase.execute(paymentId, updateInput);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe(
          'EMPLOYEE_SALARY_PAYMENT_NOT_FOUND'
        );
        expect(
          mockEmployeeSalaryPaymentRepository.update
        ).not.toHaveBeenCalled();
      }
    });

    it('should update only provided fields', async () => {
      const existingPayment = new EmployeeSalaryPayment(
        'payment-123',
        'user-123',
        5000.0,
        1,
        new Date('2024-01-15'),
        new Date(),
        new Date()
      );

      const updatedPayment = new EmployeeSalaryPayment(
        'payment-123',
        'user-123',
        6000.0,
        1,
        new Date('2024-01-15'),
        new Date(),
        new Date()
      );

      mockEmployeeSalaryPaymentRepository.findById.mockResolvedValue(
        existingPayment
      );
      mockEmployeeSalaryPaymentRepository.update.mockResolvedValue(
        updatedPayment
      );

      const result = await updateEmployeeSalaryPaymentUseCase.execute(
        paymentId,
        { amount: 6000.0 }
      );

      expect(result.amount).toBe(6000.0);
      expect(result.paymentMethod).toBe(1); // Unchanged
      expect(
        mockEmployeeSalaryPaymentRepository.update
      ).toHaveBeenCalledWith(paymentId, {
        amount: 6000.0,
      });
    });

    it('should update date when provided', async () => {
      const existingPayment = new EmployeeSalaryPayment(
        'payment-123',
        'user-123',
        5000.0,
        1,
        new Date('2024-01-15'),
        new Date(),
        new Date()
      );

      const updatedPayment = new EmployeeSalaryPayment(
        'payment-123',
        'user-123',
        5000.0,
        1,
        new Date('2024-02-15'),
        new Date(),
        new Date()
      );

      mockEmployeeSalaryPaymentRepository.findById.mockResolvedValue(
        existingPayment
      );
      mockEmployeeSalaryPaymentRepository.update.mockResolvedValue(
        updatedPayment
      );

      const result = await updateEmployeeSalaryPaymentUseCase.execute(
        paymentId,
        { date: '2024-02-15' }
      );

      expect(
        mockEmployeeSalaryPaymentRepository.update
      ).toHaveBeenCalledWith(paymentId, {
        date: expect.any(Date),
      });
    });
  });
});

