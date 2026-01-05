import { CreateEmployeeSalaryPaymentUseCase } from '../../../../src/core/application/use-cases/employee-salary-payments/create-employee-salary-payment.use-case';
import { IEmployeeSalaryPaymentRepository } from '../../../../src/core/domain/interfaces/employee-salary-payment-repository.interface';
import { IUserRepository } from '../../../../src/core/domain/interfaces/user-repository.interface';
import { EmployeeSalaryPayment } from '../../../../src/core/domain/entities/employee-salary-payment.entity';
import { User } from '../../../../src/core/domain/entities/user.entity';
import { UserRole } from '@prisma/client';
import { AppError } from '../../../../src/shared/errors';

describe('CreateEmployeeSalaryPaymentUseCase', () => {
  let createEmployeeSalaryPaymentUseCase: CreateEmployeeSalaryPaymentUseCase;
  let mockEmployeeSalaryPaymentRepository: jest.Mocked<IEmployeeSalaryPaymentRepository>;
  let mockUserRepository: jest.Mocked<IUserRepository>;

  beforeEach(() => {
    mockEmployeeSalaryPaymentRepository = {
      findById: jest.fn(),
      findAll: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    mockUserRepository = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findAll: jest.fn(),
    };

    createEmployeeSalaryPaymentUseCase = new CreateEmployeeSalaryPaymentUseCase(
      mockEmployeeSalaryPaymentRepository,
      mockUserRepository
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    const validInput = {
      userId: 'user-123',
      amount: 5000.0,
      paymentMethod: 1,
      date: '2024-01-15',
    };

    it('should create a new employee salary payment successfully', async () => {
      const mockUser = new User(
        'user-123',
        'John',
        'Doe',
        null,
        'john@example.com',
        'hashed_password',
        null,
        true,
        UserRole.WAITER,
        new Date(),
        new Date()
      );

      const mockCreatedPayment = new EmployeeSalaryPayment(
        'payment-123',
        'user-123',
        5000.0,
        1,
        new Date('2024-01-15'),
        new Date(),
        new Date()
      );

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockEmployeeSalaryPaymentRepository.create.mockResolvedValue(
        mockCreatedPayment
      );

      const result = await createEmployeeSalaryPaymentUseCase.execute(validInput);

      expect(result).toHaveProperty('id');
      expect(result.userId).toBe('user-123');
      expect(result.amount).toBe(5000.0);
      expect(result.paymentMethod).toBe(1);
      expect(mockUserRepository.findById).toHaveBeenCalledWith('user-123');
      expect(
        mockEmployeeSalaryPaymentRepository.create
      ).toHaveBeenCalledWith({
        userId: 'user-123',
        amount: 5000.0,
        paymentMethod: 1,
        date: expect.any(Date),
      });
    });

    it('should throw error when user not found', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      try {
        await createEmployeeSalaryPaymentUseCase.execute(validInput);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('USER_NOT_FOUND');
        expect(
          mockEmployeeSalaryPaymentRepository.create
        ).not.toHaveBeenCalled();
      }
    });

    it('should use current date when date is not provided', async () => {
      const mockUser = new User(
        'user-123',
        'John',
        'Doe',
        null,
        'john@example.com',
        'hashed_password',
        null,
        true,
        UserRole.WAITER,
        new Date(),
        new Date()
      );

      const mockCreatedPayment = new EmployeeSalaryPayment(
        'payment-123',
        'user-123',
        5000.0,
        1,
        new Date(),
        new Date(),
        new Date()
      );

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockEmployeeSalaryPaymentRepository.create.mockResolvedValue(
        mockCreatedPayment
      );

      const inputWithoutDate = {
        userId: 'user-123',
        amount: 5000.0,
        paymentMethod: 1,
      };

      await createEmployeeSalaryPaymentUseCase.execute(inputWithoutDate);

      expect(
        mockEmployeeSalaryPaymentRepository.create
      ).toHaveBeenCalledWith({
        userId: 'user-123',
        amount: 5000.0,
        paymentMethod: 1,
        date: expect.any(Date),
      });
    });
  });
});

