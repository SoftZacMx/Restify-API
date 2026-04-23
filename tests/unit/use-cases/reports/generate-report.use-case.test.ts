import { GenerateReportUseCase } from '../../../../src/core/application/use-cases/reports/generate-report.use-case';
import { ReportFactory } from '../../../../src/core/application/reports/report-factory';
import { ReportType } from '../../../../src/core/domain/interfaces/report-generator.interface';
import { AppError } from '../../../../src/shared/errors';

describe('GenerateReportUseCase', () => {
  let generateReportUseCase: GenerateReportUseCase;
  let mockReportFactory: jest.Mocked<ReportFactory>;

  beforeEach(() => {
    mockReportFactory = {
      create: jest.fn(),
      getAvailableTypes: jest.fn(),
      isSupported: jest.fn(),
    } as any;

    generateReportUseCase = new GenerateReportUseCase(mockReportFactory);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should generate report successfully', async () => {
      const mockGenerator = {
        getType: () => ReportType.CASH_FLOW,
        generate: jest.fn().mockResolvedValue({
          type: ReportType.CASH_FLOW,
          generatedAt: new Date(),
          filters: {},
          data: { incomes: {}, expenses: {}, cashFlow: {} },
        }),
      };

      mockReportFactory.create.mockReturnValue(mockGenerator as any);

      const input = {
        type: ReportType.CASH_FLOW,
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31',
      };

      const result = await generateReportUseCase.execute(input);

      expect(result.type).toBe(ReportType.CASH_FLOW);
      expect(result.data).toBeDefined();
      expect(mockReportFactory.create).toHaveBeenCalledWith(ReportType.CASH_FLOW);
      // YMD inputs are interpreted as bounds in APP_TIMEZONE (America/Mexico_City, UTC-6).
      expect(mockGenerator.generate).toHaveBeenCalledWith({
        dateFrom: new Date('2024-01-01T06:00:00.000Z'),
        dateTo: new Date('2024-02-01T05:59:59.999Z'),
        page: undefined,
        pageSize: undefined,
      });
    });

    it('should convert date strings to Date objects', async () => {
      const mockGenerator = {
        getType: () => ReportType.SALES_PERFORMANCE,
        generate: jest.fn().mockResolvedValue({
          type: ReportType.SALES_PERFORMANCE,
          generatedAt: new Date(),
          filters: {},
          data: {},
        }),
      };

      mockReportFactory.create.mockReturnValue(mockGenerator as any);

      const input = {
        type: ReportType.SALES_PERFORMANCE,
        dateFrom: '2024-06-01T00:00:00.000Z',
        dateTo: '2024-06-30T23:59:59.999Z',
      };

      await generateReportUseCase.execute(input);

      expect(mockGenerator.generate).toHaveBeenCalledWith({
        dateFrom: expect.any(Date),
        dateTo: expect.any(Date),
      });
    });

    it('should handle optional date filters', async () => {
      const mockGenerator = {
        getType: () => ReportType.EXPENSE_ANALYSIS,
        generate: jest.fn().mockResolvedValue({
          type: ReportType.EXPENSE_ANALYSIS,
          generatedAt: new Date(),
          filters: {},
          data: {},
        }),
      };

      mockReportFactory.create.mockReturnValue(mockGenerator as any);

      const input = {
        type: ReportType.EXPENSE_ANALYSIS,
      };

      await generateReportUseCase.execute(input);

      expect(mockGenerator.generate).toHaveBeenCalledWith({
        dateFrom: undefined,
        dateTo: undefined,
      });
    });

    it('should pass pagination parameters', async () => {
      const mockGenerator = {
        getType: () => ReportType.CASH_FLOW,
        generate: jest.fn().mockResolvedValue({
          type: ReportType.CASH_FLOW,
          generatedAt: new Date(),
          filters: {},
          data: {},
        }),
      };

      mockReportFactory.create.mockReturnValue(mockGenerator as any);

      const input = {
        type: ReportType.CASH_FLOW,
        page: 2,
        pageSize: 50,
      };

      await generateReportUseCase.execute(input);

      expect(mockGenerator.generate).toHaveBeenCalledWith({
        dateFrom: undefined,
        dateTo: undefined,
        page: 2,
        pageSize: 50,
      });
    });

    it('should propagate errors from factory', async () => {
      mockReportFactory.create.mockImplementation(() => {
        throw new AppError('REPORT_TYPE_NOT_FOUND', 'Invalid report type');
      });

      const input = {
        type: 'INVALID_TYPE' as any,
      };

      await expect(generateReportUseCase.execute(input)).rejects.toThrow(AppError);
    });
  });
});

