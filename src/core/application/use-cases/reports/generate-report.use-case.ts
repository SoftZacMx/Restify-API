import { inject, injectable } from 'tsyringe';
import { ReportFactory } from '../../reports/report-factory';
import { ReportType, BaseReportFilters, BaseReportResult } from '../../../domain/interfaces/report-generator.interface';
import { parseReportRangeDateFrom, parseReportRangeDateTo } from '../../../../shared/utils/report-date-range.util';

export interface GenerateReportInput {
  type: ReportType;
  dateFrom?: string; // ISO date string
  dateTo?: string; // ISO date string
  page?: number;
  pageSize?: number;
}

export interface GenerateReportResult extends BaseReportResult {
  data: any; // Specific to each report type
}

@injectable()
export class GenerateReportUseCase {
  constructor(@inject('ReportFactory') private readonly reportFactory: ReportFactory) {}

  async execute(input: GenerateReportInput): Promise<GenerateReportResult> {
    // Convert date strings to Date objects
    const filters: BaseReportFilters = {
      dateFrom: input.dateFrom ? parseReportRangeDateFrom(input.dateFrom) : undefined,
      dateTo: input.dateTo ? parseReportRangeDateTo(input.dateTo) : undefined,
      page: input.page,
      pageSize: input.pageSize,
    };

    // Get the appropriate generator from factory
    const generator = this.reportFactory.create(input.type);

    // Generate the report
    const result = await generator.generate(filters);

    return result as GenerateReportResult;
  }
}

