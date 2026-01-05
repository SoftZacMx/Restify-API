import { z } from 'zod';
import { RefundStatus } from '@prisma/client';

// Create Refund Schema
export const createRefundSchema = z.object({
  paymentId: z.string().uuid('Invalid payment ID format'),
  amount: z.number().positive('Amount must be positive').multipleOf(0.01, 'Amount must have at most 2 decimal places'),
  reason: z.string().max(500, 'Reason is too long').optional().nullable(),
});

// Get Refund Schema
export const getRefundSchema = z.object({
  refund_id: z.string().uuid('Invalid refund ID format'),
});

// List Refunds Schema
export const listRefundsSchema = z.object({
  paymentId: z.string().uuid('Invalid payment ID format').optional(),
  status: z.nativeEnum(RefundStatus).optional(),
  dateFrom: z.string().optional(), // ISO date string
  dateTo: z.string().optional(), // ISO date string
});

// Process Stripe Refund Schema
export const processStripeRefundSchema = z.object({
  refundId: z.string().uuid('Invalid refund ID format'),
  stripeRefundId: z.string().min(1, 'Stripe refund ID is required'),
  status: z.enum(['succeeded', 'failed'], {
    errorMap: () => ({ message: 'Status must be succeeded or failed' }),
  }),
});

// Type exports
export type CreateRefundInput = z.infer<typeof createRefundSchema>;
export type GetRefundInput = z.infer<typeof getRefundSchema>;
export type ListRefundsInput = z.infer<typeof listRefundsSchema>;
export type ProcessStripeRefundInput = z.infer<typeof processStripeRefundSchema>;

