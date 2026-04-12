import { inject, injectable } from 'tsyringe';
import { IOrderRepository } from '../../../domain/interfaces/order-repository.interface';
import { IPaymentRepository } from '../../../domain/interfaces/payment-repository.interface';
import { IPaymentSessionRepository } from '../../../domain/interfaces/payment-session-repository.interface';
import { PayOrderWithCardStripeInput } from '../../dto/payment.dto';
import { PaymentStatus, PaymentMethod, PaymentGateway } from '@prisma/client';
import { AppError } from '../../../../shared/errors';
import { StripeService } from '../../../infrastructure/payment-gateways/stripe.service';

export interface PayOrderWithCardStripeResult {
  payment: {
    id: string;
    orderId: string;
    amount: number;
    status: PaymentStatus;
    paymentMethod: PaymentMethod;
    gatewayTransactionId: string | null;
    createdAt: Date;
  };
  paymentSession: {
    clientSecret: string;
    paymentId: string;
    expiresAt: Date;
  };
}

@injectable()
export class PayOrderWithCardStripeUseCase {
  constructor(
    @inject('IOrderRepository') private readonly orderRepository: IOrderRepository,
    @inject('IPaymentRepository') private readonly paymentRepository: IPaymentRepository,
    @inject('IPaymentSessionRepository') private readonly paymentSessionRepository: IPaymentSessionRepository,
    @inject('StripeService') private readonly stripeService: StripeService
  ) {}

  async execute(input: PayOrderWithCardStripeInput): Promise<PayOrderWithCardStripeResult> {
    // 1. Validate order exists and is not paid
    const order = await this.orderRepository.findById(input.orderId);
    if (!order) {
      throw new AppError('ORDER_NOT_FOUND');
    }

    if (order.status) {
      throw new AppError('ORDER_ALREADY_PAID');
    }

    if (!order.userId) {
      throw new AppError('VALIDATION_ERROR', 'Cannot process payment: order has no associated user');
    }

    // 2. Create payment with PENDING status
    const payment = await this.paymentRepository.create({
      orderId: order.id,
      userId: order.userId,
      amount: order.total,
      currency: 'USD',
      status: PaymentStatus.PENDING,
      paymentMethod: PaymentMethod.CARD_STRIPE,
      gateway: PaymentGateway.STRIPE,
    });

    // 3. Create PaymentIntent in Stripe
    const stripeIntent = await this.stripeService.createPaymentIntent({
      amount: Math.round(order.total * 100), // Convert to cents
      currency: 'usd',
      metadata: {
        orderId: order.id,
        paymentId: payment.id,
        userId: order.userId,
      },
    });

    // 4. Update payment with gateway transaction ID
    const updatedPayment = await this.paymentRepository.update(payment.id, {
      gatewayTransactionId: stripeIntent.id,
    });

    // 5. Create PaymentSession
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    const paymentSession = await this.paymentSessionRepository.create({
      paymentId: payment.id,
      clientSecret: stripeIntent.client_secret,
      connectionId: input.connectionId || null,
      expiresAt,
    });

    // ⚠️ Order.status is NOT updated yet - will be updated when payment is confirmed via WebSocket

    return {
      payment: {
        id: updatedPayment.id,
        orderId: updatedPayment.orderId!,
        amount: updatedPayment.amount,
        status: updatedPayment.status,
        paymentMethod: updatedPayment.paymentMethod,
        gatewayTransactionId: updatedPayment.gatewayTransactionId,
        createdAt: updatedPayment.createdAt,
      },
      paymentSession: {
        clientSecret: paymentSession.clientSecret,
        paymentId: paymentSession.paymentId,
        expiresAt: paymentSession.expiresAt,
      },
    };
  }
}

