import { z } from 'zod';
import { dateFilterSchema } from '../../../shared/schemas/date-filter.schema';
import { ReportType } from '../../domain/interfaces/report-generator.interface';
import { MAX_REPORT_RANGE_DAYS, exceedsReportRangeLimit } from '../../../shared/utils/date-range.util';

// Report Type enum validation
const reportTypeEnum = z.nativeEnum(ReportType);

// Generate Report Schema
export const generateReportSchema = z
  .object({
    type: reportTypeEnum,
    dateFrom: dateFilterSchema,
    dateTo: dateFilterSchema,
    page: z
      .string()
      .regex(/^\d+$/)
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : undefined)),
    pageSize: z
      .string()
      .regex(/^\d+$/)
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : undefined)),
  })
  .refine(({ dateFrom, dateTo }) => !exceedsReportRangeLimit(new Date(dateFrom), new Date(dateTo)), {
    message: `El rango no puede exceder ${MAX_REPORT_RANGE_DAYS} dias`,
    path: ['dateFrom'],
  });

// Type exports
export type GenerateReportInput = z.infer<typeof generateReportSchema>;

