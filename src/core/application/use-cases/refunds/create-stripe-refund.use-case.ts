import { inject, injectable } from 'tsyringe';
import { IPaymentRepository } from '../../../domain/interfaces/payment-repository.interface';
import { IRefundRepository } from '../../../domain/interfaces/refund-repository.interface';
import { CreateRefundInput } from '../../dto/refund.dto';
import { PaymentStatus, RefundStatus } from '@prisma/client';
import { AppError } from '../../../../shared/errors';
import { StripeService } from '../../../infrastructure/payment-gateways/stripe.service';

export interface CreateStripeRefundResult {
  refund: {
    id: string;
    paymentId: string;
    amount: number;
    reason: string | null;
    status: RefundStatus;
    gatewayRefundId: string | null;
    createdAt: Date;
  };
  payment: {
    id: string;
    status: PaymentStatus;
  };
}

@injectable()
export class CreateStripeRefundUseCase {
  constructor(
    @inject('IPaymentRepository') private readonly paymentRepository: IPaymentRepository,
    @inject('IRefundRepository') private readonly refundRepository: IRefundRepository,
    @inject('StripeService') private readonly stripeService: StripeService
  ) {}

  async execute(input: CreateRefundInput): Promise<CreateStripeRefundResult> {
    // 1. Validate payment exists
    const payment = await this.paymentRepository.findById(input.paymentId);
    if (!payment) {
      throw new AppError('PAYMENT_NOT_FOUND');
    }

    // 2. Validate payment is via Stripe
    if (payment.gateway !== 'STRIPE' || !payment.gatewayTransactionId) {
      throw new AppError('PAYMENT_NOT_STRIPE',
        'This payment is not processed via Stripe. Use create-refund endpoint instead.');
    }

    // 3. Validate payment status (must be SUCCEEDED)
    if (payment.status !== PaymentStatus.SUCCEEDED) {
      throw new AppError('PAYMENT_NOT_REFUNDABLE',
        `Payment must be SUCCEEDED to create a refund. Current status: ${payment.status}`);
    }

    // 4. Check existing refunds
    const existingRefunds = await this.refundRepository.findByPaymentId(payment.id);
    const totalRefunded = existingRefunds
      .filter((r) => r.status === RefundStatus.SUCCEEDED)
      .reduce((sum, r) => sum + r.amount, 0);

    // 5. Validate refund amount
    const remainingAmount = payment.amount - totalRefunded;
    if (input.amount > remainingAmount) {
      throw new AppError('REFUND_AMOUNT_EXCEEDS_REMAINING',
        `Refund amount (${input.amount}) exceeds remaining refundable amount (${remainingAmount})`);
    }

    if (input.amount <= 0) {
      throw new AppError('INVALID_AMOUNT', 'Refund amount must be positive');
    }

    // 6. Create refund in Stripe
    let stripeRefund;
    try {
      stripeRefund = await this.stripeService.createRefund(
        payment.gatewayTransactionId,
        input.amount
      );
    } catch (error: any) {
      throw new AppError('STRIPE_REFUND_FAILED',
        `Failed to create refund in Stripe: ${error.message}`);
    }

    // 7. Create refund record (PENDING initially, will be updated via webhook)
    const refund = await this.refundRepository.create({
      paymentId: payment.id,
      amount: input.amount,
      reason: input.reason || null,
      gatewayRefundId: stripeRefund.id,
      status: RefundStatus.PENDING, // Will be updated when Stripe processes it
    });

    // 8. Update payment status based on refund amount
    if (input.amount === remainingAmount) {
      // Full refund
      await this.paymentRepository.update(payment.id, {
        status: PaymentStatus.REFUNDED,
      });
    } else {
      // Partial refund
      await this.paymentRepository.update(payment.id, {
        status: PaymentStatus.PARTIALLY_REFUNDED,
      });
    }

    const updatedPayment = await this.paymentRepository.findById(payment.id);

    return {
      refund: {
        id: refund.id,
        paymentId: refund.paymentId,
        amount: refund.amount,
        reason: refund.reason,
        status: refund.status,
        gatewayRefundId: refund.gatewayRefundId,
        createdAt: refund.createdAt,
      },
      payment: {
        id: updatedPayment!.id,
        status: updatedPayment!.status,
      },
    };
  }
}

