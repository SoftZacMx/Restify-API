import { inject, injectable } from 'tsyringe';
import { IOrderRepository } from '../../../domain/interfaces/order-repository.interface';
import { IPaymentRepository } from '../../../domain/interfaces/payment-repository.interface';
import { PayOrderWithCashInput } from '../../dto/payment.dto';
import { PaymentStatus, PaymentMethod, PaymentGateway } from '@prisma/client';
import { AppError } from '../../../../shared/errors';

export interface PayOrderWithCashResult {
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
export class PayOrderWithCashUseCase {
  constructor(
    @inject('IOrderRepository') private readonly orderRepository: IOrderRepository,
    @inject('IPaymentRepository') private readonly paymentRepository: IPaymentRepository
  ) {}

  async execute(input: PayOrderWithCashInput): Promise<PayOrderWithCashResult> {
    // 1. Validate order exists and is not paid
    const order = await this.orderRepository.findById(input.orderId);
    if (!order) {
      throw new AppError('ORDER_NOT_FOUND');
    }

    if (order.status) {
      throw new AppError('ORDER_ALREADY_PAID');
    }

    // 2. Create payment (SUCCEEDED immediately for cash)
    const payment = await this.paymentRepository.create({
      orderId: order.id,
      userId: order.userId,
      amount: order.total,
      currency: 'USD',
      status: PaymentStatus.SUCCEEDED,
      paymentMethod: PaymentMethod.CASH,
      gateway: null, // No gateway for cash
    });

    // 3. Update order status
    const updatedOrder = await this.orderRepository.update(order.id, {
      status: true,
      paymentMethod: 1, // 1 = Cash
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

