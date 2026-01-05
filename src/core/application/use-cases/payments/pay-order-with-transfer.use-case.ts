import { inject, injectable } from 'tsyringe';
import { IOrderRepository } from '../../../domain/interfaces/order-repository.interface';
import { IPaymentRepository } from '../../../domain/interfaces/payment-repository.interface';
import { PayOrderWithTransferInput } from '../../dto/payment.dto';
import { PaymentStatus, PaymentMethod, PaymentGateway } from '@prisma/client';
import { AppError } from '../../../../shared/errors';

export interface PayOrderWithTransferResult {
  payment: {
    id: string;
    orderId: string;
    amount: number;
    status: PaymentStatus;
    paymentMethod: PaymentMethod;
    metadata?: any;
    createdAt: Date;
  };
  order: {
    id: string;
    status: boolean;
    paymentMethod: number | null;
  };
}

@injectable()
export class PayOrderWithTransferUseCase {
  constructor(
    @inject('IOrderRepository') private readonly orderRepository: IOrderRepository,
    @inject('IPaymentRepository') private readonly paymentRepository: IPaymentRepository
  ) {}

  async execute(input: PayOrderWithTransferInput): Promise<PayOrderWithTransferResult> {
    // 1. Validate order exists and is not paid
    const order = await this.orderRepository.findById(input.orderId);
    if (!order) {
      throw new AppError('ORDER_NOT_FOUND');
    }

    if (order.status) {
      throw new AppError('ORDER_ALREADY_PAID');
    }

    // 2. Create payment (SUCCEEDED immediately for transfer)
    const metadata = input.transferNumber ? { transferNumber: input.transferNumber } : null;
    
    const payment = await this.paymentRepository.create({
      orderId: order.id,
      userId: order.userId,
      amount: order.total,
      currency: 'USD',
      status: PaymentStatus.SUCCEEDED,
      paymentMethod: PaymentMethod.TRANSFER,
      gateway: null, // No gateway for transfer
      metadata,
    });

    // 3. Update order status
    const updatedOrder = await this.orderRepository.update(order.id, {
      status: true,
      paymentMethod: 2, // 2 = Transfer
    });

    return {
      payment: {
        id: payment.id,
        orderId: payment.orderId!,
        amount: payment.amount,
        status: payment.status,
        paymentMethod: payment.paymentMethod,
        metadata: payment.metadata,
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

