/**
 * Report Type Enum
 * Defines all available report types in the system
 */
export enum ReportType {
  CASH_FLOW = 'CASH_FLOW',
  SALES_PERFORMANCE = 'SALES_PERFORMANCE',
  EXPENSE_ANALYSIS = 'EXPENSE_ANALYSIS',
}

/**
 * Base filters that all reports share
 */
export interface BaseReportFilters {
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  pageSize?: number;
}

/**
 * Base structure for all report results
 */
export interface BaseReportResult {
  type: ReportType;
  generatedAt: Date;
  filters: BaseReportFilters;
  data: any; // Specific data for each report type
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Interface that all report generators must implement
 */
export interface IReportGenerator {
  /**
   * Get the report type this generator handles
   */
  getType(): ReportType;

  /**
   * Generate the report with the given filters
   */
  generate(filters: BaseReportFilters): Promise<BaseReportResult>;
}

