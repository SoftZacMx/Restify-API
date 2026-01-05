import { z } from 'zod';
import { PaymentMethod, PaymentStatus } from '@prisma/client';

// Pay Order with Cash Schema
export const payOrderWithCashSchema = z.object({
  orderId: z.string().uuid('Invalid order ID format'),
});

// Pay Order with Transfer Schema
export const payOrderWithTransferSchema = z.object({
  orderId: z.string().uuid('Invalid order ID format'),
  transferNumber: z.string().max(100, 'Transfer number is too long').optional(),
});

// Pay Order with Card Physical Schema
export const payOrderWithCardPhysicalSchema = z.object({
  orderId: z.string().uuid('Invalid order ID format'),
});

// Pay Order with Stripe Schema
export const payOrderWithCardStripeSchema = z.object({
  orderId: z.string().uuid('Invalid order ID format'),
  connectionId: z.string().optional().nullable(), // WebSocket connection ID
});

// Split Payment Schema
export const payOrderWithSplitPaymentSchema = z.object({
  orderId: z.string().uuid('Invalid order ID format'),
  firstPayment: z.object({
    amount: z.number().positive('Amount must be positive').multipleOf(0.01, 'Amount must have at most 2 decimal places'),
    paymentMethod: z.enum(['CASH', 'TRANSFER', 'CARD_PHYSICAL'], {
      errorMap: () => ({ message: 'First payment method must be CASH, TRANSFER or CARD_PHYSICAL' }),
    }),
  }),
  secondPayment: z.object({
    amount: z.number().positive('Amount must be positive').multipleOf(0.01, 'Amount must have at most 2 decimal places'),
    paymentMethod: z.enum(['CASH', 'TRANSFER', 'CARD_PHYSICAL'], {
      errorMap: () => ({ message: 'Second payment method must be CASH, TRANSFER or CARD_PHYSICAL' }),
    }),
  }),
}).refine(
  (data) => {
    // Methods must be different
    return data.firstPayment.paymentMethod !== data.secondPayment.paymentMethod;
  },
  {
    message: 'Split payments must use different payment methods',
    path: ['secondPayment', 'paymentMethod'],
  }
).refine(
  (data) => {
    // Sum must not exceed order total (will be validated in use case with actual order total)
    const total = data.firstPayment.amount + data.secondPayment.amount;
    return total > 0;
  },
  {
    message: 'Total payment amount must be positive',
  }
);

// Confirm Stripe Payment Schema
export const confirmStripePaymentSchema = z.object({
  paymentIntentId: z.string().min(1, 'Payment intent ID is required'),
  status: z.enum(['succeeded', 'failed'], {
    errorMap: () => ({ message: 'Status must be succeeded or failed' }),
  }),
});

// Get Payment Schema
export const getPaymentSchema = z.object({
  payment_id: z.string().uuid('Invalid payment ID format'),
});

// List Payments Schema
export const listPaymentsSchema = z.object({
  orderId: z.string().uuid('Invalid order ID format').optional(),
  userId: z.string().uuid('Invalid user ID format').optional(),
  status: z.nativeEnum(PaymentStatus).optional(),
  paymentMethod: z.nativeEnum(PaymentMethod).optional(),
  dateFrom: z.string().optional(), // ISO date string
  dateTo: z.string().optional(), // ISO date string
});

// Get Payment Session Schema
export const getPaymentSessionSchema = z.object({
  payment_id: z.string().uuid('Invalid payment ID format'),
});

// Type exports
export type PayOrderWithCashInput = z.infer<typeof payOrderWithCashSchema>;
export type PayOrderWithTransferInput = z.infer<typeof payOrderWithTransferSchema>;
export type PayOrderWithCardPhysicalInput = z.infer<typeof payOrderWithCardPhysicalSchema>;
export type PayOrderWithCardStripeInput = z.infer<typeof payOrderWithCardStripeSchema>;
export type PayOrderWithSplitPaymentInput = z.infer<typeof payOrderWithSplitPaymentSchema>;
export type ConfirmStripePaymentInput = z.infer<typeof confirmStripePaymentSchema>;
export type GetPaymentInput = z.infer<typeof getPaymentSchema>;
export type ListPaymentsInput = z.infer<typeof listPaymentsSchema>;
export type GetPaymentSessionInput = z.infer<typeof getPaymentSessionSchema>;

