import { inject, injectable } from 'tsyringe';
import { IOrderRepository } from '../../../domain/interfaces/order-repository.interface';
import { IPaymentRepository } from '../../../domain/interfaces/payment-repository.interface';
import { PayOrderWithCardPhysicalInput } from '../../dto/payment.dto';
import { PaymentStatus, PaymentMethod, PaymentGateway } from '@prisma/client';
import { AppError } from '../../../../shared/errors';

export interface PayOrderWithCardPhysicalResult {
  payment: {
    id: string;
    orderId: string;
    amount: number;
    status: PaymentStatus;
    paymentMethod: PaymentMethod;
    createdAt: Date;
  };
  order: {
    id: string;
    status: boolean;
    paymentMethod: number | null;
  };
}

@injectable()
export class PayOrderWithCardPhysicalUseCase {
  constructor(
    @inject('IOrderRepository') private readonly orderRepository: IOrderRepository,
    @inject('IPaymentRepository') private readonly paymentRepository: IPaymentRepository
  ) {}

  async execute(input: PayOrderWithCardPhysicalInput): Promise<PayOrderWithCardPhysicalResult> {
    // 1. Validate order exists and is not paid
    const order = await this.orderRepository.findById(input.orderId);
    if (!order) {
      throw new AppError('ORDER_NOT_FOUND');
    }

    if (order.status) {
      throw new AppError('ORDER_ALREADY_PAID');
    }

    // 2. Create payment (SUCCEEDED immediately for physical card)
    const payment = await this.paymentRepository.create({
      orderId: order.id,
      userId: order.userId,
      amount: order.total,
      currency: 'USD',
      status: PaymentStatus.SUCCEEDED,
      paymentMethod: PaymentMethod.CARD_PHYSICAL,
      gateway: null, // No gateway for physical card (POS local)
    });

    // 3. Update order status
    const updatedOrder = await this.orderRepository.update(order.id, {
      status: true,
      paymentMethod: 3, // 3 = Card
    });

    return {
      payment: {
        id: payment.id,
        orderId: payment.orderId!,
        amount: payment.amount,
        status: payment.status,
        paymentMethod: payment.paymentMethod,
        createdAt: payment.createdAt,
      },
      order: {
        id: updatedOrder.id,
        status: updatedOrder.status,
        paymentMethod: updatedOrder.paymentMethod,
      },
    };
  }
}

