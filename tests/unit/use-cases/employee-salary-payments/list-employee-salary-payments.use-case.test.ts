import { ListEmployeeSalaryPaymentsUseCase } from '../../../../src/core/application/use-cases/employee-salary-payments/list-employee-salary-payments.use-case';
import { IEmployeeSalaryPaymentRepository } from '../../../../src/core/domain/interfaces/employee-salary-payment-repository.interface';
import { EmployeeSalaryPayment } from '../../../../src/core/domain/entities/employee-salary-payment.entity';

describe('ListEmployeeSalaryPaymentsUseCase', () => {
  let listEmployeeSalaryPaymentsUseCase: ListEmployeeSalaryPaymentsUseCase;
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

    listEmployeeSalaryPaymentsUseCase = new ListEmployeeSalaryPaymentsUseCase(
      mockEmployeeSalaryPaymentRepository
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should return all payments when no filters provided', async () => {
      const mockPayments = [
        new EmployeeSalaryPayment(
          'payment-1',
          'user-123',
          5000.0,
          1,
          new Date('2024-01-15'),
          new Date(),
          new Date()
        ),
        new EmployeeSalaryPayment(
          'payment-2',
          'user-456',
          6000.0,
          2,
          new Date('2024-01-16'),
          new Date(),
          new Date()
        ),
      ];

      mockEmployeeSalaryPaymentRepository.findAll.mockResolvedValue(
        mockPayments
      );
      mockEmployeeSalaryPaymentRepository.count.mockResolvedValue(2);

      const result = await listEmployeeSalaryPaymentsUseCase.execute();

      expect(result.data).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.pageSize).toBe(20);
      expect(result.pagination.totalPages).toBe(1);
    });

    it('should filter by userId', async () => {
      const mockPayments = [
        new EmployeeSalaryPayment(
          'payment-1',
          'user-123',
          5000.0,
          1,
          new Date('2024-01-15'),
          new Date(),
          new Date()
        ),
      ];

      mockEmployeeSalaryPaymentRepository.findAll.mockResolvedValue(
        mockPayments
      );
      mockEmployeeSalaryPaymentRepository.count.mockResolvedValue(1);

      const result = await listEmployeeSalaryPaymentsUseCase.execute({
        userId: 'user-123',
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].userId).toBe('user-123');
    });

    it('should filter by paymentMethod', async () => {
      const mockPayments = [
        new EmployeeSalaryPayment(
          'payment-1',
          'user-123',
          5000.0,
          1,
          new Date('2024-01-15'),
          new Date(),
          new Date()
        ),
      ];

      mockEmployeeSalaryPaymentRepository.findAll.mockResolvedValue(
        mockPayments
      );
      mockEmployeeSalaryPaymentRepository.count.mockResolvedValue(1);

      const result = await listEmployeeSalaryPaymentsUseCase.execute({
        paymentMethod: 1,
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].paymentMethod).toBe(1);
    });

    it('should filter by date range', async () => {
      const mockPayments = [
        new EmployeeSalaryPayment(
          'payment-1',
          'user-123',
          5000.0,
          1,
          new Date('2024-06-15'),
          new Date(),
          new Date()
        ),
      ];

      mockEmployeeSalaryPaymentRepository.findAll.mockResolvedValue(
        mockPayments
      );
      mockEmployeeSalaryPaymentRepository.count.mockResolvedValue(1);

      const result = await listEmployeeSalaryPaymentsUseCase.execute({
        dateFrom: '2024-01-01',
        dateTo: '2024-12-31',
      });

      expect(result.data).toHaveLength(1);
    });

    it('should apply pagination', async () => {
      const mockPayments = [
        new EmployeeSalaryPayment(
          'payment-1',
          'user-123',
          5000.0,
          1,
          new Date('2024-01-15'),
          new Date(),
          new Date()
        ),
      ];

      mockEmployeeSalaryPaymentRepository.findAll.mockResolvedValue(
        mockPayments
      );
      mockEmployeeSalaryPaymentRepository.count.mockResolvedValue(25);

      const result = await listEmployeeSalaryPaymentsUseCase.execute({
        page: 1,
        pageSize: 10,
      });

      expect(result.pagination.page).toBe(1);
      expect(result.pagination.pageSize).toBe(10);
      expect(result.pagination.total).toBe(25);
      expect(result.pagination.totalPages).toBe(3);
    });

    it('should limit pageSize to 100', async () => {
      const mockPayments = [
        new EmployeeSalaryPayment(
          'payment-1',
          'user-123',
          5000.0,
          1,
          new Date('2024-01-15'),
          new Date(),
          new Date()
        ),
      ];

      mockEmployeeSalaryPaymentRepository.findAll.mockResolvedValue(
        mockPayments
      );
      mockEmployeeSalaryPaymentRepository.count.mockResolvedValue(1);

      const result = await listEmployeeSalaryPaymentsUseCase.execute({
        pageSize: 200,
      });

      expect(result.pagination.pageSize).toBe(100);
      expect(mockEmployeeSalaryPaymentRepository.findAll).toHaveBeenCalledWith(
        {
          userId: undefined,
          paymentMethod: undefined,
          dateFrom: undefined,
          dateTo: undefined,
        },
        { skip: 0, take: 100 }
      );
    });
  });
});

