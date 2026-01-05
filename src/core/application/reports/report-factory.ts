import { injectable, container } from 'tsyringe';
import { IReportGenerator, ReportType } from '../../domain/interfaces/report-generator.interface';
import { CashFlowReportGenerator } from './generators/cash-flow-report.generator';
import { SalesPerformanceReportGenerator } from './generators/sales-performance-report.generator';
import { ExpenseAnalysisReportGenerator } from './generators/expense-analysis-report.generator';
import { AppError } from '../../../shared/errors';

/**
 * Factory for creating report generators
 * Implements Factory Pattern to create the appropriate generator based on report type
 */
@injectable()
export class ReportFactory {
  private generators: Map<ReportType, IReportGenerator>;

  constructor() {
    this.generators = new Map();
    this.initializeGenerators();
  }

  /**
   * Initialize all available report generators
   * This method registers all generators in the factory
   */
  private initializeGenerators(): void {
    // Register Cash Flow Report Generator
    const cashFlowGenerator = container.resolve(CashFlowReportGenerator);
    this.generators.set(ReportType.CASH_FLOW, cashFlowGenerator);

    // Register Sales Performance Report Generator
    const salesPerformanceGenerator = container.resolve(SalesPerformanceReportGenerator);
    this.generators.set(ReportType.SALES_PERFORMANCE, salesPerformanceGenerator);

    // Register Expense Analysis Report Generator
    const expenseAnalysisGenerator = container.resolve(ExpenseAnalysisReportGenerator);
    this.generators.set(ReportType.EXPENSE_ANALYSIS, expenseAnalysisGenerator);
  }

  /**
   * Create a report generator for the given report type
   * @param type The type of report to generate
   * @returns The appropriate report generator
   * @throws AppError if the report type is not found
   */
  create(type: ReportType): IReportGenerator {
    const generator = this.generators.get(type);

    if (!generator) {
      throw new AppError('REPORT_TYPE_NOT_FOUND', `Report type '${type}' is not supported`);
    }

    return generator;
  }

  /**
   * Get all available report types
   * @returns Array of available report types
   */
  getAvailableTypes(): ReportType[] {
    return Array.from(this.generators.keys());
  }

  /**
   * Check if a report type is supported
   * @param type The report type to check
   * @returns True if the report type is supported, false otherwise
   */
  isSupported(type: ReportType): boolean {
    return this.generators.has(type);
  }
}

