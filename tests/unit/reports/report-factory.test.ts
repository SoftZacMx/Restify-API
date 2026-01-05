import { ReportFactory } from '../../../src/core/application/reports/report-factory';
import { ReportType } from '../../../src/core/domain/interfaces/report-generator.interface';
import { AppError } from '../../../src/shared/errors';

// Mock the generators
jest.mock('../../../src/core/application/reports/generators/cash-flow-report.generator', () => ({
  CashFlowReportGenerator: jest.fn().mockImplementation(() => ({
    getType: () => ReportType.CASH_FLOW,
    generate: jest.fn(),
  })),
}));

jest.mock('../../../src/core/application/reports/generators/sales-performance-report.generator', () => ({
  SalesPerformanceReportGenerator: jest.fn().mockImplementation(() => ({
    getType: () => ReportType.SALES_PERFORMANCE,
    generate: jest.fn(),
  })),
}));

jest.mock('../../../src/core/application/reports/generators/expense-analysis-report.generator', () => ({
  ExpenseAnalysisReportGenerator: jest.fn().mockImplementation(() => ({
    getType: () => ReportType.EXPENSE_ANALYSIS,
    generate: jest.fn(),
  })),
}));

describe('ReportFactory', () => {
  let factory: ReportFactory;

  beforeEach(() => {
    factory = new ReportFactory();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create CashFlowReportGenerator for CASH_FLOW type', () => {
      const generator = factory.create(ReportType.CASH_FLOW);

      expect(generator).toBeDefined();
      expect(generator.getType()).toBe(ReportType.CASH_FLOW);
    });

    it('should create SalesPerformanceReportGenerator for SALES_PERFORMANCE type', () => {
      const generator = factory.create(ReportType.SALES_PERFORMANCE);

      expect(generator).toBeDefined();
      expect(generator.getType()).toBe(ReportType.SALES_PERFORMANCE);
    });

    it('should create ExpenseAnalysisReportGenerator for EXPENSE_ANALYSIS type', () => {
      const generator = factory.create(ReportType.EXPENSE_ANALYSIS);

      expect(generator).toBeDefined();
      expect(generator.getType()).toBe(ReportType.EXPENSE_ANALYSIS);
    });

    it('should throw error for unsupported report type', () => {
      // Cast to any to test invalid type
      const invalidType = 'INVALID_TYPE' as any;

      expect(() => {
        factory.create(invalidType);
      }).toThrow(AppError);
    });
  });

  describe('getAvailableTypes', () => {
    it('should return all available report types', () => {
      const types = factory.getAvailableTypes();

      expect(types).toContain(ReportType.CASH_FLOW);
      expect(types).toContain(ReportType.SALES_PERFORMANCE);
      expect(types).toContain(ReportType.EXPENSE_ANALYSIS);
      expect(types.length).toBe(3);
    });
  });

  describe('isSupported', () => {
    it('should return true for supported report types', () => {
      expect(factory.isSupported(ReportType.CASH_FLOW)).toBe(true);
      expect(factory.isSupported(ReportType.SALES_PERFORMANCE)).toBe(true);
      expect(factory.isSupported(ReportType.EXPENSE_ANALYSIS)).toBe(true);
    });

    it('should return false for unsupported report types', () => {
      const invalidType = 'INVALID_TYPE' as any;
      expect(factory.isSupported(invalidType)).toBe(false);
    });
  });
});

