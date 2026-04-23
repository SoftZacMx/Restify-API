import { z } from 'zod';
import { dateFilterSchema } from '../../../shared/schemas/date-filter.schema';

// Create Employee Salary Payment Schema
export const createEmployeeSalaryPaymentSchema = z.object({
  userId: z.string().uuid('Invalid user ID format'),
  amount: z
    .number()
    .positive('Amount must be positive')
    .multipleOf(0.01, 'Amount must have at most 2 decimal places'),
  paymentMethod: z
    .number()
    .int()
    .min(1)
    .max(3, 'Payment method must be 1 (Cash), 2 (Transfer), or 3 (Card)'),
  date: z.string().optional(), // ISO date string, defaults to now
});

// Get Employee Salary Payment Schema
export const getEmployeeSalaryPaymentSchema = z.object({
  employee_salary_payment_id: z
    .string()
    .uuid('Invalid employee salary payment ID format'),
});

// List Employee Salary Payments Schema
export const listEmployeeSalaryPaymentsSchema = z.object({
  userId: z.string().uuid('Invalid user ID format').optional(),
  paymentMethod: z.number().int().min(1).max(3).optional(),
  dateFrom: dateFilterSchema.optional(),
  dateTo: dateFilterSchema.optional(),
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

// Update Employee Salary Payment Schema
export const updateEmployeeSalaryPaymentSchema = z.object({
  amount: z
    .number()
    .positive('Amount must be positive')
    .multipleOf(0.01, 'Amount must have at most 2 decimal places')
    .optional(),
  paymentMethod: z.number().int().min(1).max(3).optional(),
  date: z.string().optional(), // ISO date string
});

// Type exports
export type CreateEmployeeSalaryPaymentInput = z.infer<
  typeof createEmployeeSalaryPaymentSchema
>;
export type GetEmployeeSalaryPaymentInput = z.infer<
  typeof getEmployeeSalaryPaymentSchema
>;
export type ListEmployeeSalaryPaymentsInput = z.infer<
  typeof listEmployeeSalaryPaymentsSchema
>;
export type UpdateEmployeeSalaryPaymentInput = z.infer<
  typeof updateEmployeeSalaryPaymentSchema
>;

