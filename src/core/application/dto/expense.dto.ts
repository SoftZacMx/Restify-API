import { z } from 'zod';
import { ExpenseType } from '@prisma/client';

// Expense Type enum validation
const expenseTypeEnum = z.nativeEnum(ExpenseType);

// Create Expense Schema
export const createExpenseSchema = z.object({
  type: expenseTypeEnum,
  date: z.string().optional(), // ISO date string, defaults to now
  total: z.number().positive('Total must be positive').multipleOf(0.01, 'Total must have at most 2 decimal places'),
  subtotal: z.number().positive('Subtotal must be positive').multipleOf(0.01, 'Subtotal must have at most 2 decimal places'),
  iva: z.number().min(0, 'IVA must be non-negative').multipleOf(0.01, 'IVA must have at most 2 decimal places'),
  description: z.string().max(500, 'Description is too long').optional().nullable(),
  paymentMethod: z.number().int().min(1).max(3, 'Payment method must be 1 (Cash), 2 (Transfer), or 3 (Card)'),
  userId: z.string().uuid('Invalid user ID format'),
  items: z
    .array(
      z.object({
        productId: z.string().uuid('Invalid product ID format'),
        amount: z.number().positive('Amount must be positive').multipleOf(0.01, 'Amount must have at most 2 decimal places'),
        subtotal: z.number().positive('Subtotal must be positive').multipleOf(0.01, 'Subtotal must have at most 2 decimal places'),
        total: z.number().positive('Total must be positive').multipleOf(0.01, 'Total must have at most 2 decimal places'),
        unitOfMeasure: z.string().max(50, 'Unit of measure is too long').optional().nullable(),
      })
    )
    .optional(),
}).superRefine((data, ctx) => {
  // If type is MERCHANDISE, items are required
  if (data.type === ExpenseType.MERCHANDISE) {
    if (!data.items || data.items.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Items are required for MERCHANDISE type expenses',
        path: ['items'],
      });
    }
  } else {
    // For other types, items should not be provided
    if (data.items && data.items.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Items are only allowed for MERCHANDISE type expenses',
        path: ['items'],
      });
    }
  }
});

// Get Expense Schema
export const getExpenseSchema = z.object({
  expense_id: z.string().uuid('Invalid expense ID format'),
});

// List Expenses Schema
export const listExpensesSchema = z.object({
  type: expenseTypeEnum.optional(),
  userId: z.string().uuid('Invalid user ID format').optional(),
  paymentMethod: z.number().int().min(1).max(3).optional(),
  dateFrom: z.string().optional(), // ISO date string
  dateTo: z.string().optional(), // ISO date string
  page: z.string().regex(/^\d+$/).optional().transform((val) => (val ? parseInt(val, 10) : undefined)),
  pageSize: z.string().regex(/^\d+$/).optional().transform((val) => (val ? parseInt(val, 10) : undefined)),
});

// Update Expense Schema
export const updateExpenseSchema = z.object({
  date: z.string().optional(), // ISO date string
  total: z.number().positive('Total must be positive').multipleOf(0.01, 'Total must have at most 2 decimal places').optional(),
  subtotal: z.number().positive('Subtotal must be positive').multipleOf(0.01, 'Subtotal must have at most 2 decimal places').optional(),
  iva: z.number().min(0, 'IVA must be non-negative').multipleOf(0.01, 'IVA must have at most 2 decimal places').optional(),
  description: z.string().max(500, 'Description is too long').optional().nullable(),
  paymentMethod: z.number().int().min(1).max(3).optional(),
});

// Type exports
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type GetExpenseInput = z.infer<typeof getExpenseSchema>;
export type ListExpensesInput = z.infer<typeof listExpensesSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;

