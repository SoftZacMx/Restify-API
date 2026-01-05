import { z } from 'zod';
import { ReportType } from '../../domain/interfaces/report-generator.interface';

// Report Type enum validation
const reportTypeEnum = z.nativeEnum(ReportType);

// Generate Report Schema
export const generateReportSchema = z.object({
  type: reportTypeEnum,
  dateFrom: z.string().optional(), // ISO date string
  dateTo: z.string().optional(), // ISO date string
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
});

// Type exports
export type GenerateReportInput = z.infer<typeof generateReportSchema>;

