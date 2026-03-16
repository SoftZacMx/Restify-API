import {
  ReportsSummaryResponse,
  ReportsSummaryKpis,
  SalesByDayItem,
  PaymentDistributionItem,
  TopProductItem,
  ExpenseByCategoryItem,
  DailyTableRow,
} from '../../application/dto/reports-summary.dto';

export interface IReportsSummaryRepository {
  getSummary(dateFrom: Date, dateTo: Date): Promise<ReportsSummaryResponse>;
}
