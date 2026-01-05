import { inject, injectable } from 'tsyringe';
import { IRefundRepository } from '../../../domain/interfaces/refund-repository.interface';
import { IPaymentRepository } from '../../../domain/interfaces/payment-repository.interface';
import { ProcessStripeRefundInput } from '../../dto/refund.dto';
import { RefundStatus, PaymentStatus } from '@prisma/client';
import { AppError } from '../../../../shared/errors';
import { StripeService } from '../../../infrastructure/payment-gateways/stripe.service';

export interface ProcessStripeRefundResult {
  refund: {
    id: string;
    paymentId: string;
    status: RefundStatus;
    gatewayRefundId: string | null;
  };
  payment: {
    id: string;
    status: PaymentStatus;
  };
}

@injectable()
export class ProcessStripeRefundUseCase {
  constructor(
    @inject('IRefundRepository') private readonly refundRepository: IRefundRepository,
    @inject('IPaymentRepository') private readonly paymentRepository: IPaymentRepository,
    @inject('StripeService') private readonly stripeService: StripeService
  ) {}

  async execute(input: ProcessStripeRefundInput): Promise<ProcessStripeRefundResult> {
    // 1. Find refund
    const refund = await this.refundRepository.findById(input.refundId);
    if (!refund) {
      throw new AppError('REFUND_NOT_FOUND');
    }

    // 2. Verify refund with Stripe
    try {
      const stripeRefund = await this.stripeService.retrieveRefund(input.stripeRefundId);
      
      // Validate that the status matches
      if (input.status === 'succeeded' && stripeRefund.status !== 'succeeded') {
        throw new AppError('REFUND_STATUS_MISMATCH',
          `Stripe refund status (${stripeRefund.status}) does not match expected status (succeeded)`);
      }

      if (input.status === 'failed' && stripeRefund.status !== 'failed') {
        throw new AppError('REFUND_STATUS_MISMATCH',
          `Stripe refund status (${stripeRefund.status}) does not match expected status (failed)`);
      }
    } catch (error: any) {
      // If Stripe service throws, it might be a network error or invalid ID
      if (error.code === 'REFUND_STATUS_MISMATCH') {
        throw error;
      }
      // For other errors, we'll still process the refund update
      console.warn('Stripe refund verification failed:', error.message);
    }

    // 3. Update refund status
    const newStatus = input.status === 'succeeded' 
      ? RefundStatus.SUCCEEDED 
      : RefundStatus.FAILED;

    const updatedRefund = await this.refundRepository.update(refund.id, {
      status: newStatus,
      gatewayRefundId: input.stripeRefundId,
    });

    // 4. If succeeded, update payment status
    const payment = await this.paymentRepository.findById(refund.paymentId);
    if (!payment) {
      throw new AppError('PAYMENT_NOT_FOUND');
    }

    if (input.status === 'succeeded') {
      // Check if this is a full or partial refund
      const allRefunds = await this.refundRepository.findByPaymentId(payment.id);
      const totalRefunded = allRefunds
        .filter((r) => r.status === RefundStatus.SUCCEEDED)
        .reduce((sum, r) => sum + r.amount, 0);

      if (totalRefunded >= payment.amount) {
        await this.paymentRepository.update(payment.id, {
          status: PaymentStatus.REFUNDED,
        });
      } else {
        await this.paymentRepository.update(payment.id, {
          status: PaymentStatus.PARTIALLY_REFUNDED,
        });
      }
    }

    const updatedPayment = await this.paymentRepository.findById(payment.id);

    return {
      refund: {
        id: updatedRefund.id,
        paymentId: updatedRefund.paymentId,
        status: updatedRefund.status,
        gatewayRefundId: updatedRefund.gatewayRefundId,
      },
      payment: {
        id: updatedPayment!.id,
        status: updatedPayment!.status,
      },
    };
  }
}

