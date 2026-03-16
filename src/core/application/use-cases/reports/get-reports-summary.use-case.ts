import { inject, injectable } from 'tsyringe';
import type { ReportsSummaryQuery, ReportsSummaryResponse } from '../../dto/reports-summary.dto';
import type { IReportsSummaryRepository } from '../../../domain/interfaces/reports-summary-repository.interface';

@injectable()
export class GetReportsSummaryUseCase {
  constructor(
    @inject('IReportsSummaryRepository')
    private readonly reportsSummaryRepository: IReportsSummaryRepository
  ) {}

  async execute(query?: ReportsSummaryQuery): Promise<ReportsSummaryResponse> {
    const now = new Date();
    const defaultDays = 30;
    const dateTo = query?.dateTo ? new Date(query.dateTo + 'T23:59:59.999Z') : now;
    const dateFrom = query?.dateFrom
      ? new Date(query.dateFrom + 'T00:00:00.000Z')
      : new Date(dateTo.getTime() - (defaultDays - 1) * 24 * 60 * 60 * 1000);

    if (dateFrom > dateTo) {
      throw new Error('dateFrom must be before or equal to dateTo');
    }

    return this.reportsSummaryRepository.getSummary(dateFrom, dateTo);
  }
}
