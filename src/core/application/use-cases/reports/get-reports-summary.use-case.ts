import { inject, injectable } from 'tsyringe';
import type { ReportsSummaryQuery, ReportsSummaryResponse } from '../../dto/reports-summary.dto';
import type { IReportsSummaryRepository } from '../../../domain/interfaces/reports-summary-repository.interface';
import {
  startOfDayInZone,
  endOfDayInZone,
  exceedsReportRangeLimit,
  MAX_REPORT_RANGE_DAYS,
} from '../../../../shared/utils/date-range.util';
import { AppError } from '../../../../shared/errors/app-error';
import { BranchTimezoneService } from '../../services/branch-timezone.service';

@injectable()
export class GetReportsSummaryUseCase {
  constructor(
    @inject('IReportsSummaryRepository')
    private readonly reportsSummaryRepository: IReportsSummaryRepository,
    @inject(BranchTimezoneService) private readonly branchTimezoneService: BranchTimezoneService
  ) {}

  async execute(query?: ReportsSummaryQuery): Promise<ReportsSummaryResponse> {
    const timezone = await this.branchTimezoneService.get();

    const now = new Date();
    const defaultDays = 30;
    const dateTo = query?.dateTo ? endOfDayInZone(query.dateTo, timezone) : now;
    const dateFrom = query?.dateFrom
      ? startOfDayInZone(query.dateFrom, timezone)
      : new Date(dateTo.getTime() - (defaultDays - 1) * 24 * 60 * 60 * 1000);

    if (dateFrom > dateTo) {
      throw new AppError('VALIDATION_ERROR', 'dateFrom must be before or equal to dateTo');
    }
    if (exceedsReportRangeLimit(dateFrom, dateTo)) {
      throw new AppError(
        'VALIDATION_ERROR',
        `El rango no puede exceder ${MAX_REPORT_RANGE_DAYS} dias`
      );
    }

    return this.reportsSummaryRepository.getSummary(dateFrom, dateTo, timezone);
  }
}
