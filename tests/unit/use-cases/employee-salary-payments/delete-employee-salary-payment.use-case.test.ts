import { DeleteEmployeeSalaryPaymentUseCase } from '../../../../src/core/application/use-cases/employee-salary-payments/delete-employee-salary-payment.use-case';
import { IEmployeeSalaryPaymentRepository } from '../../../../src/core/domain/interfaces/employee-salary-payment-repository.interface';
import { EmployeeSalaryPayment } from '../../../../src/core/domain/entities/employee-salary-payment.entity';
import { AppError } from '../../../../src/shared/errors';

describe('DeleteEmployeeSalaryPaymentUseCase', () => {
  let deleteEmployeeSalaryPaymentUseCase: DeleteEmployeeSalaryPaymentUseCase;
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

    deleteEmployeeSalaryPaymentUseCase = new DeleteEmployeeSalaryPaymentUseCase(
      mockEmployeeSalaryPaymentRepository
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    const validInput = {
      employee_salary_payment_id: 'payment-123',
    };

    it('should delete payment successfully', async () => {
      const existingPayment = new EmployeeSalaryPayment(
        'payment-123',
        'user-123',
        5000.0,
        1,
        new Date('2024-01-15'),
        new Date(),
        new Date()
      );

      mockEmployeeSalaryPaymentRepository.findById.mockResolvedValue(
        existingPayment
      );
      mockEmployeeSalaryPaymentRepository.delete.mockResolvedValue();

      await deleteEmployeeSalaryPaymentUseCase.execute(validInput);

      expect(
        mockEmployeeSalaryPaymentRepository.findById
      ).toHaveBeenCalledWith('payment-123');
      expect(
        mockEmployeeSalaryPaymentRepository.delete
      ).toHaveBeenCalledWith('payment-123');
    });

    it('should throw error when payment not found', async () => {
      mockEmployeeSalaryPaymentRepository.findById.mockResolvedValue(null);

      try {
        await deleteEmployeeSalaryPaymentUseCase.execute(validInput);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe(
          'EMPLOYEE_SALARY_PAYMENT_NOT_FOUND'
        );
        expect(
          mockEmployeeSalaryPaymentRepository.delete
        ).not.toHaveBeenCalled();
      }
    });
  });
});

