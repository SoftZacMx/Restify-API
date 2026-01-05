import { GetEmployeeSalaryPaymentUseCase } from '../../../../src/core/application/use-cases/employee-salary-payments/get-employee-salary-payment.use-case';
import { IEmployeeSalaryPaymentRepository } from '../../../../src/core/domain/interfaces/employee-salary-payment-repository.interface';
import { EmployeeSalaryPayment } from '../../../../src/core/domain/entities/employee-salary-payment.entity';
import { AppError } from '../../../../src/shared/errors';

describe('GetEmployeeSalaryPaymentUseCase', () => {
  let getEmployeeSalaryPaymentUseCase: GetEmployeeSalaryPaymentUseCase;
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

    getEmployeeSalaryPaymentUseCase = new GetEmployeeSalaryPaymentUseCase(
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

    it('should return payment data when payment exists', async () => {
      const mockPayment = new EmployeeSalaryPayment(
        'payment-123',
        'user-123',
        5000.0,
        1,
        new Date('2024-01-15'),
        new Date(),
        new Date()
      );

      mockEmployeeSalaryPaymentRepository.findById.mockResolvedValue(
        mockPayment
      );

      const result = await getEmployeeSalaryPaymentUseCase.execute(validInput);

      expect(result).toHaveProperty('id');
      expect(result.id).toBe('payment-123');
      expect(result.userId).toBe('user-123');
      expect(result.amount).toBe(5000.0);
      expect(result.paymentMethod).toBe(1);
      expect(
        mockEmployeeSalaryPaymentRepository.findById
      ).toHaveBeenCalledWith('payment-123');
    });

    it('should throw error when payment not found', async () => {
      mockEmployeeSalaryPaymentRepository.findById.mockResolvedValue(null);

      try {
        await getEmployeeSalaryPaymentUseCase.execute(validInput);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe(
          'EMPLOYEE_SALARY_PAYMENT_NOT_FOUND'
        );
      }
    });
  });
});

