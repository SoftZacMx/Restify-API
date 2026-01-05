import { inject, injectable } from 'tsyringe';
import { IPaymentRepository } from '../../../domain/interfaces/payment-repository.interface';
import { IRefundRepository } from '../../../domain/interfaces/refund-repository.interface';
import { CreateRefundInput } from '../../dto/refund.dto';
import { PaymentStatus, RefundStatus } from '@prisma/client';
import { AppError } from '../../../../shared/errors';

export interface CreateRefundResult {
  refund: {
    id: string;
    paymentId: string;
    amount: number;
    reason: string | null;
    status: RefundStatus;
    createdAt: Date;
  };
  payment: {
    id: string;
    status: PaymentStatus;
  };
}

@injectable()
export class CreateRefundUseCase {
  constructor(
    @inject('IPaymentRepository') private readonly paymentRepository: IPaymentRepository,
    @inject('IRefundRepository') private readonly refundRepository: IRefundRepository
  ) {}

  async execute(input: CreateRefundInput): Promise<CreateRefundResult> {
    // 1. Validate payment exists
    const payment = await this.paymentRepository.findById(input.paymentId);
    if (!payment) {
      throw new AppError('PAYMENT_NOT_FOUND');
    }

    // 2. Validate payment status (must be SUCCEEDED)
    if (payment.status !== PaymentStatus.SUCCEEDED) {
      throw new AppError('PAYMENT_NOT_REFUNDABLE',
        `Payment must be SUCCEEDED to create a refund. Current status: ${payment.status}`);
    }

    // 3. Check existing refunds for this payment
    const existingRefunds = await this.refundRepository.findByPaymentId(payment.id);
    const totalRefunded = existingRefunds
      .filter((r) => r.status === RefundStatus.SUCCEEDED)
      .reduce((sum, r) => sum + r.amount, 0);

    // 4. Validate refund amount
    const remainingAmount = payment.amount - totalRefunded;
    if (input.amount > remainingAmount) {
      throw new AppError('REFUND_AMOUNT_EXCEEDS_REMAINING',
        `Refund amount (${input.amount}) exceeds remaining refundable amount (${remainingAmount})`);
    }

    if (input.amount <= 0) {
      throw new AppError('INVALID_AMOUNT', 'Refund amount must be positive');
    }

    // 5. Determine refund status based on payment gateway
    let refundStatus: RefundStatus;
    let gatewayRefundId: string | null = null;

    // If payment is via Stripe, we'll need to process it asynchronously
    if (payment.gateway === 'STRIPE' && payment.gatewayTransactionId) {
      // Status will be updated when Stripe processes the refund
      refundStatus = RefundStatus.PENDING;
    } else {
      // For cash, transfer, or physical card, mark as SUCCEEDED immediately
      refundStatus = RefundStatus.SUCCEEDED;
    }

    // 6. Create refund
    const refund = await this.refundRepository.create({
      paymentId: payment.id,
      amount: input.amount,
      reason: input.reason || null,
      gatewayRefundId,
      status: refundStatus,
    });

    // 7. Update payment status if fully refunded
    if (input.amount === remainingAmount) {
      await this.paymentRepository.update(payment.id, {
        status: PaymentStatus.REFUNDED,
      });
    } else if (totalRefunded + input.amount < payment.amount) {
      // Partial refund
      await this.paymentRepository.update(payment.id, {
        status: PaymentStatus.PARTIALLY_REFUNDED,
      });
    }

    // Get updated payment
    const updatedPayment = await this.paymentRepository.findById(payment.id);

    return {
      refund: {
        id: refund.id,
        paymentId: refund.paymentId,
        amount: refund.amount,
        reason: refund.reason,
        status: refund.status,
        createdAt: refund.createdAt,
      },
      payment: {
        id: updatedPayment!.id,
        status: updatedPayment!.status,
      },
    };
  }
}

