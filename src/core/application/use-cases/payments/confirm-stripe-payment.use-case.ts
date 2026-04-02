import { inject, injectable } from 'tsyringe';
import { IPaymentRepository } from '../../../domain/interfaces/payment-repository.interface';
import { IOrderRepository } from '../../../domain/interfaces/order-repository.interface';
import { ITableRepository } from '../../../domain/interfaces/table-repository.interface';
import { ConfirmStripePaymentInput } from '../../dto/payment.dto';
import { PaymentStatus } from '@prisma/client';
import { AppError } from '../../../../shared/errors';
import { StripeService } from '../../../infrastructure/payment-gateways/stripe.service';

export interface ConfirmStripePaymentResult {
  payment: {
    id: string;
    orderId: string | null;
    status: PaymentStatus;
    gatewayTransactionId: string | null;
  };
  order?: {
    id: string;
    status: boolean;
    paymentMethod: number | null;
  };
  tableReleased?: boolean;
}

@injectable()
export class ConfirmStripePaymentUseCase {
  constructor(
    @inject('IPaymentRepository') private readonly paymentRepository: IPaymentRepository,
    @inject('IOrderRepository') private readonly orderRepository: IOrderRepository,
    @inject('ITableRepository') private readonly tableRepository: ITableRepository,
    @inject('StripeService') private readonly stripeService: StripeService,
  ) {}

  async execute(input: ConfirmStripePaymentInput): Promise<ConfirmStripePaymentResult> {
    // 1. Find payment by gateway transaction ID
    const payment = await this.paymentRepository.findByGatewayTransactionId(input.paymentIntentId);
    if (!payment) {
      throw new AppError('PAYMENT_NOT_FOUND');
    }

    // 2. Verify payment intent status with Stripe
    const stripeIntent = await this.stripeService.retrievePaymentIntent(input.paymentIntentId);
    
    // Validate that the status matches
    if (input.status === 'succeeded' && stripeIntent.status !== 'succeeded') {
      throw new AppError('PAYMENT_STATUS_MISMATCH',
        `Payment intent status (${stripeIntent.status}) does not match expected status (succeeded)`);
    }

    const failedStatuses = ['payment_failed', 'canceled', 'requires_payment_method'];
    if (input.status === 'failed' && !failedStatuses.includes(stripeIntent.status)) {
      throw new AppError('PAYMENT_STATUS_MISMATCH',
        `Payment intent status (${stripeIntent.status}) does not match expected status (failed)`);
    }

    // 3. Update payment status
    const newStatus = input.status === 'succeeded' 
      ? PaymentStatus.SUCCEEDED 
      : PaymentStatus.FAILED;

    const updatedPayment = await this.paymentRepository.update(payment.id, {
      status: newStatus,
    });

    // 4. If succeeded, update order status and release table if applicable
    let updatedOrder: { id: string; status: boolean; paymentMethod: number | null } | undefined = undefined;
    let tableReleased = false;
    
    if (input.status === 'succeeded' && payment.orderId) {
      // First, get the order to check tableId and origin
      const existingOrder = await this.orderRepository.findById(payment.orderId);
      
      const order = await this.orderRepository.update(payment.orderId, {
        status: true,
        paymentMethod: 3, // 3 = Card
      });
      updatedOrder = {
        id: order.id,
        status: order.status,
        paymentMethod: order.paymentMethod,
      };

      // 5. Release table if order is local and has a table assigned
      if (existingOrder && existingOrder.tableId && existingOrder.origin.toLowerCase() === 'local') {
        await this.tableRepository.update(existingOrder.tableId, {
          availabilityStatus: true, // Mark table as available
        });
        tableReleased = true;
      }
    }

    return {
      payment: {
        id: updatedPayment.id,
        orderId: updatedPayment.orderId,
        status: updatedPayment.status,
        gatewayTransactionId: updatedPayment.gatewayTransactionId,
      },
      order: updatedOrder,
      tableReleased,
    };
  }
}

