import { ExpenseAnalysisReportGenerator } from '../../../../src/core/application/reports/generators/expense-analysis-report.generator';
import { IExpenseRepository } from '../../../../src/core/domain/interfaces/expense-repository.interface';
import { IEmployeeSalaryPaymentRepository } from '../../../../src/core/domain/interfaces/employee-salary-payment-repository.interface';
import { ReportType } from '../../../../src/core/domain/interfaces/report-generator.interface';
import { Expense } from '../../../../src/core/domain/entities/expense.entity';
import { EmployeeSalaryPayment } from '../../../../src/core/domain/entities/employee-salary-payment.entity';
import { ExpenseType } from '@prisma/client';

describe('ExpenseAnalysisReportGenerator', () => {
  let generator: ExpenseAnalysisReportGenerator;
  let mockExpenseRepository: jest.Mocked<IExpenseRepository>;
  let mockEmployeeSalaryPaymentRepository: jest.Mocked<IEmployeeSalaryPaymentRepository>;

  beforeEach(() => {
    mockExpenseRepository = {
      findById: jest.fn(),
      findByPaymentId: jest.fn(),
      findAll: jest.fn(),
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
      findAllWithUser: jest.fn(),
    };

    mockEmployeeSalaryPaymentRepository = {
      findById: jest.fn(),
      findAll: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    generator = new ExpenseAnalysisReportGenerator(
      mockExpenseRepository,
      mockEmployeeSalaryPaymentRepository
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getType', () => {
    it('should return EXPENSE_ANALYSIS type', () => {
      expect(generator.getType()).toBe(ReportType.EXPENSE_ANALYSIS);
    });
  });

  describe('generate', () => {
    const baseFilters = {
      dateFrom: new Date('2024-01-01'),
      dateTo: new Date('2024-01-31'),
    };

    it('should generate expense analysis report successfully', async () => {
      const mockExpenses = [
        new Expense(
          'expense-1',
          'Cleaning service',
          ExpenseType.SERVICE_BUSINESS,
          new Date('2024-01-10'),
          500,
          450,
          50,
          'Cleaning service',
          1,
          'user-1',
          null,
          new Date(),
          new Date()
        ),
        new Expense(
          'expense-2',
          'Electricity',
          ExpenseType.UTILITY,
          new Date('2024-01-15'),
          300,
          270,
          30,
          'Electricity',
          2,
          'user-1',
          null,
          new Date(),
          new Date()
        ),
        new Expense(
          'expense-3',
          'Food supplies',
          ExpenseType.MERCHANDISE,
          new Date('2024-01-20'),
          800,
          700,
          100,
          'Food supplies',
          1,
          'user-1',
          null,
          new Date(),
          new Date()
        ),
      ];

      const mockEmployeeSalaries = [
        new EmployeeSalaryPayment('salary-1', 'user-1', 2000, 1, new Date('2024-01-05'), new Date(), new Date()),
      ];

      mockExpenseRepository.findAll.mockResolvedValue(mockExpenses);
      mockEmployeeSalaryPaymentRepository.findAll.mockResolvedValue(mockEmployeeSalaries);

      const result = await generator.generate(baseFilters);

      expect(result.type).toBe(ReportType.EXPENSE_ANALYSIS);
      expect(result.data).toBeDefined();
      expect(result.data.expensesByCategory.businessServices.total).toBe(500);
      expect(result.data.expensesByCategory.utilities.total).toBe(300);
      expect(result.data.expensesByCategory.merchandise.total).toBe(800);
      expect(result.data.employeeSalaries.total).toBe(2000);
      expect(result.data.summary.totalExpenses).toBe(3600); // 500 + 300 + 800 + 2000
    });

    it('should calculate percentages correctly', async () => {
      const mockExpenses = [
        new Expense('expense-1', 'Expense 1', ExpenseType.SERVICE_BUSINESS, new Date(), 1000, 900, 100, null, 1, 'user-1', null, new Date(), new Date()),
      ];

      const mockEmployeeSalaries = [
        new EmployeeSalaryPayment('salary-1', 'user-1', 1000, 1, new Date(), new Date(), new Date()),
      ];

      mockExpenseRepository.findAll.mockResolvedValue(mockExpenses);
      mockEmployeeSalaryPaymentRepository.findAll.mockResolvedValue(mockEmployeeSalaries);

      const result = await generator.generate(baseFilters);

      // Total: 2000, Business Services: 1000 (50%), Salaries: 1000 (50%)
      expect(result.data.expensesByCategory.businessServices.percentage).toBeCloseTo(50, 1);
      expect(result.data.employeeSalaries.percentage).toBeCloseTo(50, 1);
    });

    it('should group expenses by payment method', async () => {
      const mockExpenses = [
        new Expense('expense-1', 'Expense 1', ExpenseType.SERVICE_BUSINESS, new Date(), 500, 450, 50, null, 1, 'user-1', null, new Date(), new Date()), // Cash
        new Expense('expense-2', 'Expense 2', ExpenseType.UTILITY, new Date(), 300, 270, 30, null, 2, 'user-1', null, new Date(), new Date()), // Transfer
        new Expense('expense-3', 'Expense 3', ExpenseType.MERCHANDISE, new Date(), 200, 180, 20, null, 3, 'user-1', null, new Date(), new Date()), // Card
      ];

      const mockEmployeeSalaries = [
        new EmployeeSalaryPayment('salary-1', 'user-1', 1000, 1, new Date(), new Date(), new Date()), // Cash
      ];

      mockExpenseRepository.findAll.mockResolvedValue(mockExpenses);
      mockEmployeeSalaryPaymentRepository.findAll.mockResolvedValue(mockEmployeeSalaries);

      const result = await generator.generate(baseFilters);

      expect(result.data.summary.totalByPaymentMethod.cash).toBe(1500); // 500 + 1000
      expect(result.data.summary.totalByPaymentMethod.transfer).toBe(300);
      expect(result.data.summary.totalByPaymentMethod.card).toBe(200);
    });

    it('should identify largest expense category', async () => {
      const mockExpenses = [
        new Expense('expense-1', 'Expense 1', ExpenseType.SERVICE_BUSINESS, new Date(), 500, 450, 50, null, 1, 'user-1', null, new Date(), new Date()),
        new Expense('expense-2', 'Expense 2', ExpenseType.MERCHANDISE, new Date(), 2000, 1800, 200, null, 1, 'user-1', null, new Date(), new Date()), // Largest
      ];

      const mockEmployeeSalaries = [
        new EmployeeSalaryPayment('salary-1', 'user-1', 1000, 1, new Date(), new Date(), new Date()),
      ];

      mockExpenseRepository.findAll.mockResolvedValue(mockExpenses);
      mockEmployeeSalaryPaymentRepository.findAll.mockResolvedValue(mockEmployeeSalaries);

      const result = await generator.generate(baseFilters);

      expect(result.data.summary.largestExpenseCategory).toBe('merchandise');
    });

    it('should calculate average expense correctly', async () => {
      const mockExpenses = [
        new Expense('expense-1', 'Expense 1', ExpenseType.SERVICE_BUSINESS, new Date(), 1000, 900, 100, null, 1, 'user-1', null, new Date(), new Date()),
        new Expense('expense-2', 'Expense 2', ExpenseType.UTILITY, new Date(), 2000, 1800, 200, null, 1, 'user-1', null, new Date(), new Date()),
      ];

      const mockEmployeeSalaries = [
        new EmployeeSalaryPayment('salary-1', 'user-1', 3000, 1, new Date(), new Date(), new Date()),
      ];

      mockExpenseRepository.findAll.mockResolvedValue(mockExpenses);
      mockEmployeeSalaryPaymentRepository.findAll.mockResolvedValue(mockEmployeeSalaries);

      const result = await generator.generate(baseFilters);

      // Total: 6000, Count: 3, Average: 2000
      expect(result.data.summary.averageExpense).toBe(2000);
    });

    it('should handle empty data correctly', async () => {
      mockExpenseRepository.findAll.mockResolvedValue([]);
      mockEmployeeSalaryPaymentRepository.findAll.mockResolvedValue([]);

      const result = await generator.generate(baseFilters);

      expect(result.data.summary.totalExpenses).toBe(0);
      expect(result.data.summary.averageExpense).toBe(0);
    });
  });
});

