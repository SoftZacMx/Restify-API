import { CashFlowReportGenerator } from '../../../../src/core/application/reports/generators/cash-flow-report.generator';
import { IOrderRepository } from '../../../../src/core/domain/interfaces/order-repository.interface';
import { IExpenseRepository } from '../../../../src/core/domain/interfaces/expense-repository.interface';
import { IEmployeeSalaryPaymentRepository } from '../../../../src/core/domain/interfaces/employee-salary-payment-repository.interface';
import { IPaymentRepository } from '../../../../src/core/domain/interfaces/payment-repository.interface';
import { IPaymentDifferentiationRepository } from '../../../../src/core/domain/interfaces/payment-differentiation-repository.interface';
import { ReportType } from '../../../../src/core/domain/interfaces/report-generator.interface';
import { PaymentDifferentiation } from '../../../../src/core/domain/entities/payment-differentiation.entity';
import { Order } from '../../../../src/core/domain/entities/order.entity';
import { Expense } from '../../../../src/core/domain/entities/expense.entity';
import { EmployeeSalaryPayment } from '../../../../src/core/domain/entities/employee-salary-payment.entity';
import { Payment } from '../../../../src/core/domain/entities/payment.entity';
import { ExpenseType, PaymentMethod, PaymentStatus, PaymentGateway } from '@prisma/client';

describe('CashFlowReportGenerator', () => {
  let generator: CashFlowReportGenerator;
  let mockOrderRepository: jest.Mocked<IOrderRepository>;
  let mockExpenseRepository: jest.Mocked<IExpenseRepository>;
  let mockEmployeeSalaryPaymentRepository: jest.Mocked<IEmployeeSalaryPaymentRepository>;
  let mockPaymentRepository: jest.Mocked<IPaymentRepository>;
  let mockPaymentDifferentiationRepository: jest.Mocked<IPaymentDifferentiationRepository>;

  beforeEach(() => {
    mockOrderRepository = {
      findById: jest.fn(),
      findAll: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      createOrderItem: jest.fn(),
      updateOrderItem: jest.fn(),
      deleteOrderItem: jest.fn(),
      deleteOrderItemsByOrderId: jest.fn(),
      findOrderItemsByOrderId: jest.fn(),
      createOrderItemExtra: jest.fn(),
      deleteOrderItemExtrasByOrderId: jest.fn(),
      deleteOrderItemExtrasByOrderItemId: jest.fn(),
      findOrderItemExtrasByOrderId: jest.fn(),
      findOrderItemExtrasByOrderItemId: jest.fn(),
    };

    mockExpenseRepository = {
      findById: jest.fn(),
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

    mockEmployeeSalaryPaymentRepository = {
      findById: jest.fn(),
      findAll: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    mockPaymentRepository = {
      findById: jest.fn(),
      findByGatewayTransactionId: jest.fn(),
      findAll: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    mockPaymentDifferentiationRepository = {
      findById: jest.fn(),
      findByOrderId: jest.fn().mockResolvedValue(null),
      findByOrderIds: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteByOrderId: jest.fn(),
    };

    generator = new CashFlowReportGenerator(
      mockOrderRepository,
      mockExpenseRepository,
      mockEmployeeSalaryPaymentRepository,
      mockPaymentRepository,
      mockPaymentDifferentiationRepository
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getType', () => {
    it('should return CASH_FLOW type', () => {
      expect(generator.getType()).toBe(ReportType.CASH_FLOW);
    });
  });

  describe('generate', () => {
    const baseFilters = {
      dateFrom: new Date('2024-01-01'),
      dateTo: new Date('2024-01-31'),
    };

    it('should generate cash flow report successfully', async () => {
      // Mock orders (incomes)
      const mockOrders = [
        new Order(
          'order-1',
          new Date('2024-01-15'),
          true,
          1, // Cash
          1000,
          900,
          100,
          true,
          null,
          50,
          'Local',
          null,
          false,
          null,
          'user-1',
          new Date(),
          new Date()
        ),
        new Order(
          'order-2',
          new Date('2024-01-20'),
          true,
          2, // Transfer
          2000,
          1800,
          200,
          true,
          null,
          0,
          'Delivery',
          null,
          false,
          null,
          'user-1',
          new Date(),
          new Date()
        ),
      ];

      // Mock expenses
      const mockBusinessServices = [
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
          new Date(),
          new Date()
        ),
      ];

      const mockMerchandise = [
        new Expense(
          'expense-2',
          'Food supplies',
          ExpenseType.MERCHANDISE,
          new Date('2024-01-12'),
          800,
          700,
          100,
          'Food supplies',
          2,
          'user-1',
          new Date(),
          new Date()
        ),
      ];

      const mockEmployeeSalaries = [
        new EmployeeSalaryPayment(
          'salary-1',
          'user-1',
          2000,
          1,
          new Date('2024-01-05'),
          new Date(),
          new Date()
        ),
      ];

      mockOrderRepository.findAll.mockResolvedValue(mockOrders);
      mockExpenseRepository.findAll
        .mockResolvedValueOnce(mockBusinessServices) // First call for business services
        .mockResolvedValueOnce(mockMerchandise); // Second call for merchandise
      mockEmployeeSalaryPaymentRepository.findAll.mockResolvedValue(mockEmployeeSalaries);

      const result = await generator.generate(baseFilters);

      expect(result.type).toBe(ReportType.CASH_FLOW);
      expect(result.data).toBeDefined();
      expect(result.data.incomes.totalIncomes).toBe(3000); // 1000 + 2000
      expect(result.data.expenses.totalExpenses).toBe(3350); // 500 + 800 + 2000 + 50 (tip from order-1)
      expect(result.data.cashFlow.balance).toBe(-350); // 3000 - 3350
      expect(result.data.cashFlow.status).toBe('NEGATIVE');
    });

    it('should calculate positive balance correctly', async () => {
      const mockOrders = [
        new Order(
          'order-1',
          new Date('2024-01-15'),
          true,
          1,
          5000,
          4500,
          500,
          true,
          null,
          0,
          'Local',
          null,
          false,
          null,
          'user-1',
          new Date(),
          new Date()
        ),
      ];

      const mockBusinessServices: Expense[] = [];
      const mockMerchandise: Expense[] = [];
      const mockEmployeeSalaries: EmployeeSalaryPayment[] = [];

      mockOrderRepository.findAll.mockResolvedValue(mockOrders);
      mockExpenseRepository.findAll
        .mockResolvedValueOnce(mockBusinessServices)
        .mockResolvedValueOnce(mockMerchandise);
      mockEmployeeSalaryPaymentRepository.findAll.mockResolvedValue(mockEmployeeSalaries);

      const result = await generator.generate(baseFilters);

      expect(result.data.cashFlow.balance).toBe(5000);
      expect(result.data.cashFlow.status).toBe('POSITIVE');
    });

    it('should group incomes by payment method', async () => {
      const mockOrders = [
        new Order('order-1', new Date(), true, 1, 1000, 900, 100, true, null, 0, 'Local', null, false, null, 'user-1', new Date(), new Date()),
        new Order('order-2', new Date(), true, 2, 2000, 1800, 200, true, null, 0, 'Local', null, false, null, 'user-1', new Date(), new Date()),
        new Order('order-3', new Date(), true, 3, 1500, 1350, 150, true, null, 0, 'Local', null, false, null, 'user-1', new Date(), new Date()),
      ];

      mockOrderRepository.findAll.mockResolvedValue(mockOrders);
      mockExpenseRepository.findAll
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      mockEmployeeSalaryPaymentRepository.findAll.mockResolvedValue([]);

      const result = await generator.generate(baseFilters);

      expect(result.data.incomes.byPaymentMethod.cash).toBe(1000);
      expect(result.data.incomes.byPaymentMethod.transfer).toBe(2000);
      expect(result.data.incomes.byPaymentMethod.card).toBe(1500);
    });

    it('should group split payments (order.paymentMethod null) from Payment rows', async () => {
      const mockOrders = [
        new Order(
          'order-split',
          new Date(),
          true,
          null,
          300,
          270,
          30,
          true,
          null,
          0,
          'Local',
          null,
          true,
          null,
          'user-1',
          new Date(),
          new Date()
        ),
      ];
      const mockPayments: Payment[] = [
        new Payment(
          'pay-1',
          'order-split',
          'user-1',
          100,
          'USD',
          PaymentStatus.SUCCEEDED,
          PaymentMethod.CASH,
          null,
          null,
          null,
          new Date(),
          new Date()
        ),
        new Payment(
          'pay-2',
          'order-split',
          'user-1',
          200,
          'USD',
          PaymentStatus.SUCCEEDED,
          PaymentMethod.CARD_PHYSICAL,
          null,
          null,
          null,
          new Date(),
          new Date()
        ),
      ];

      mockOrderRepository.findAll.mockResolvedValue(mockOrders);
      mockPaymentRepository.findAll.mockResolvedValue(mockPayments);
      mockPaymentDifferentiationRepository.findByOrderIds.mockResolvedValue([]);
      mockExpenseRepository.findAll.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      mockEmployeeSalaryPaymentRepository.findAll.mockResolvedValue([]);

      const result = await generator.generate(baseFilters);

      expect(mockPaymentDifferentiationRepository.findByOrderIds).toHaveBeenCalledWith(['order-split']);
      expect(mockPaymentRepository.findAll).toHaveBeenCalledWith({
        orderIds: ['order-split'],
        status: PaymentStatus.SUCCEEDED,
      });
      expect(result.data.incomes.totalIncomes).toBe(300);
      expect(result.data.incomes.byPaymentMethod.cash).toBe(100);
      expect(result.data.incomes.byPaymentMethod.card).toBe(200);
      expect(result.data.incomes.byPaymentMethod.transfer).toBe(0);
    });

    it('should group split from PaymentDifferentiation when there are no Payment rows', async () => {
      const mockOrders = [
        new Order(
          'order-diff',
          new Date(),
          true,
          null,
          80,
          72,
          8,
          true,
          null,
          0,
          'Local',
          null,
          true,
          null,
          'user-1',
          new Date(),
          new Date()
        ),
      ];
      const mockDiff = new PaymentDifferentiation(
        'diff-1',
        'order-diff',
        40,
        PaymentMethod.CASH,
        40,
        PaymentMethod.TRANSFER,
        new Date(),
        new Date()
      );

      mockOrderRepository.findAll.mockResolvedValue(mockOrders);
      mockPaymentRepository.findAll.mockResolvedValue([]);
      mockPaymentDifferentiationRepository.findByOrderIds.mockResolvedValue([mockDiff]);
      mockExpenseRepository.findAll.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      mockEmployeeSalaryPaymentRepository.findAll.mockResolvedValue([]);

      const result = await generator.generate(baseFilters);

      expect(mockPaymentDifferentiationRepository.findByOrderIds).toHaveBeenCalledWith(['order-diff']);
      expect(result.data.incomes.totalIncomes).toBe(80);
      expect(result.data.incomes.byPaymentMethod.cash).toBe(40);
      expect(result.data.incomes.byPaymentMethod.transfer).toBe(40);
      expect(result.data.incomes.byPaymentMethod.card).toBe(0);
    });

    it('should prefer PaymentDifferentiation over partial Payment rows for split orders', async () => {
      const mockOrders = [
        new Order(
          'order-partial',
          new Date(),
          true,
          null,
          300,
          270,
          30,
          true,
          null,
          0,
          'Local',
          null,
          true,
          null,
          'user-1',
          new Date(),
          new Date()
        ),
      ];
      const mockDiff = new PaymentDifferentiation(
        'diff-p',
        'order-partial',
        150,
        PaymentMethod.CASH,
        150,
        PaymentMethod.TRANSFER,
        new Date(),
        new Date()
      );
      const mockPayments: Payment[] = [
        new Payment(
          'pay-partial',
          'order-partial',
          'user-1',
          42.5,
          'USD',
          PaymentStatus.SUCCEEDED,
          PaymentMethod.TRANSFER,
          null,
          null,
          null,
          new Date(),
          new Date()
        ),
      ];

      mockOrderRepository.findAll.mockResolvedValue(mockOrders);
      mockPaymentRepository.findAll.mockResolvedValue(mockPayments);
      mockPaymentDifferentiationRepository.findByOrderIds.mockResolvedValue([mockDiff]);
      mockExpenseRepository.findAll.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      mockEmployeeSalaryPaymentRepository.findAll.mockResolvedValue([]);

      const result = await generator.generate(baseFilters);

      expect(result.data.incomes.totalIncomes).toBe(300);
      expect(result.data.incomes.byPaymentMethod.cash).toBe(150);
      expect(result.data.incomes.byPaymentMethod.transfer).toBe(150);
      expect(result.data.incomes.byPaymentMethod.card).toBe(0);
    });

    it('should include tips in expenses', async () => {
      const mockOrders = [
        new Order(
          'order-1',
          new Date('2024-01-15'),
          true,
          1,
          1000,
          900,
          100,
          true,
          null,
          100, // Tip
          'Local',
          null,
          false,
          null,
          'user-1',
          new Date(),
          new Date()
        ),
      ];

      mockOrderRepository.findAll.mockResolvedValue(mockOrders);
      mockExpenseRepository.findAll
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      mockEmployeeSalaryPaymentRepository.findAll.mockResolvedValue([]);

      const result = await generator.generate(baseFilters);

      expect(result.data.expenses.tips.total).toBe(100);
      expect(result.data.expenses.totalExpenses).toBe(100);
    });

    it('should handle empty data correctly', async () => {
      mockOrderRepository.findAll.mockResolvedValue([]);
      mockExpenseRepository.findAll
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      mockEmployeeSalaryPaymentRepository.findAll.mockResolvedValue([]);

      const result = await generator.generate(baseFilters);

      expect(result.data.incomes.totalIncomes).toBe(0);
      expect(result.data.expenses.totalExpenses).toBe(0);
      expect(result.data.cashFlow.balance).toBe(0);
      expect(result.data.cashFlow.status).toBe('BREAK_EVEN');
    });

    it('should validate date filters', async () => {
      const invalidFilters = {
        dateFrom: new Date('2024-01-31'),
        dateTo: new Date('2024-01-01'), // dateFrom > dateTo
      };

      await expect(generator.generate(invalidFilters)).rejects.toThrow();
    });
  });
});

