import { IReportGenerator, ReportType, BaseReportFilters, BaseReportResult } from '../../domain/interfaces/report-generator.interface';

/**
 * Base abstract class for all report generators
 * Implements Template Method pattern to ensure consistent structure
 */
export abstract class BaseReportGenerator implements IReportGenerator {
  /**
   * Each generator must specify its report type
   */
  abstract getType(): ReportType;

  /**
   * Fetch raw data from repositories
   * Each report implements its own data fetching logic
   */
  protected abstract fetchData(filters: BaseReportFilters): Promise<any>;

  /**
   * Transform raw data into report format
   * Each report implements its own transformation logic
   */
  protected abstract transformData(rawData: any, filters: BaseReportFilters): any;

  /**
   * Template Method: Defines the skeleton of the report generation algorithm
   * Subclasses cannot override this method, ensuring consistent structure
   */
  async generate(filters: BaseReportFilters): Promise<BaseReportResult> {
    // Step 1: Validate filters (common validation)
    this.validateFilters(filters);

    // Step 2: Normalize filters (set defaults, etc.)
    const normalizedFilters = this.normalizeFilters(filters);

    // Step 3: Fetch data (specific to each report)
    const rawData = await this.fetchData(normalizedFilters);

    // Step 4: Transform data (specific to each report)
    const transformedData = this.transformData(rawData, normalizedFilters);

    // Step 5: Build result with common structure
    return this.buildResult(transformedData, normalizedFilters);
  }

  /**
   * Validate common filters
   * Can be overridden by subclasses for additional validation
   */
  protected validateFilters(filters: BaseReportFilters): void {
    if (filters.dateFrom && filters.dateTo) {
      if (filters.dateFrom > filters.dateTo) {
        throw new Error('dateFrom cannot be greater than dateTo');
      }
    }
  }

  /**
   * Normalize filters (set defaults, etc.)
   * Can be overridden by subclasses for specific normalization
   */
  protected normalizeFilters(filters: BaseReportFilters): BaseReportFilters {
    return {
      ...filters,
      page: filters.page || 1,
      pageSize: filters.pageSize ? Math.min(filters.pageSize, 100) : 20, // Max 100 items per page
    };
  }

  /**
   * Build the final result structure
   * Can be overridden by subclasses if needed
   */
  protected buildResult(data: any, filters: BaseReportFilters): any {
    const result: any = {
      type: this.getType(),
      generatedAt: new Date(),
      filters: {
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
      },
      data,
    };

    // Add pagination if applicable
    if (data.pagination) {
      result.pagination = data.pagination;
    }

    return result;
  }

  /**
   * Helper method to calculate pagination
   */
  protected calculatePagination(
    total: number,
    page: number,
    pageSize: number
  ): { page: number; pageSize: number; total: number; totalPages: number } {
    return {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Helper method to format dates consistently
   */
  protected formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}

