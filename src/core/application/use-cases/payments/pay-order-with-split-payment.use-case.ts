import { inject, injectable } from 'tsyringe';
import { IOrderRepository } from '../../../domain/interfaces/order-repository.interface';
import { IPaymentRepository } from '../../../domain/interfaces/payment-repository.interface';
import { IPaymentDifferentiationRepository } from '../../../domain/interfaces/payment-differentiation-repository.interface';
import { PayOrderWithSplitPaymentInput } from '../../dto/payment.dto';
import { PaymentStatus, PaymentMethod } from '@prisma/client';
import { AppError } from '../../../../shared/errors';

export interface PayOrderWithSplitPaymentResult {
  paymentDifferentiation: {
    id: string;
    orderId: string;
    firstPaymentAmount: number;
    firstPaymentMethod: PaymentMethod;
    secondPaymentAmount: number;
    secondPaymentMethod: PaymentMethod;
  };
  payments: Array<{
    id: string;
    amount: number;
    status: PaymentStatus;
    paymentMethod: PaymentMethod;
  }>;
  order: {
    id: string;
    status: boolean;
    paymentDiffer: boolean;
    paymentMethod: number | null;
  };
}

@injectable()
export class PayOrderWithSplitPaymentUseCase {
  constructor(
    @inject('IOrderRepository') private readonly orderRepository: IOrderRepository,
    @inject('IPaymentRepository') private readonly paymentRepository: IPaymentRepository,
    @inject('IPaymentDifferentiationRepository') private readonly paymentDiffRepository: IPaymentDifferentiationRepository
  ) {}

  async execute(input: PayOrderWithSplitPaymentInput): Promise<PayOrderWithSplitPaymentResult> {
    // 1. Validate order exists and is not paid
    const order = await this.orderRepository.findById(input.orderId);
    if (!order) {
      throw new AppError('ORDER_NOT_FOUND');
    }

    if (order.status) {
      throw new AppError('ORDER_ALREADY_PAID');
    }

    if (order.paymentDiffer) {
      throw new AppError('SPLIT_PAYMENT_ALREADY_EXISTS');
    }

    // 2. Validate payment methods (must be different and not STRIPE)
    const allowedMethods = [PaymentMethod.CASH, PaymentMethod.TRANSFER, PaymentMethod.CARD_PHYSICAL];
    
    if (!allowedMethods.includes(input.firstPayment.paymentMethod)) {
      throw new AppError('SPLIT_PAYMENT_INVALID_METHOD',
        'First payment method must be CASH, TRANSFER or CARD_PHYSICAL');
    }
    
    if (!allowedMethods.includes(input.secondPayment.paymentMethod)) {
      throw new AppError('SPLIT_PAYMENT_INVALID_METHOD',
        'Second payment method must be CASH, TRANSFER or CARD_PHYSICAL');
    }
    
    // Methods must be different
    if (input.firstPayment.paymentMethod === input.secondPayment.paymentMethod) {
      throw new AppError('SPLIT_PAYMENT_SAME_METHOD',
        'Split payments must use different payment methods');
    }

    // 3. Validate amounts
    const totalAmount = input.firstPayment.amount + input.secondPayment.amount;
    const orderTotal = Number(order.total);
    
    if (input.firstPayment.amount <= 0 || input.secondPayment.amount <= 0) {
      throw new AppError('INVALID_AMOUNT', 'Payment amounts must be positive');
    }
    
    if (totalAmount > orderTotal) {
      throw new AppError('SPLIT_PAYMENT_AMOUNT_EXCEEDS_TOTAL',
        `Total split amount (${totalAmount}) exceeds order total (${orderTotal})`);
    }
    
    // Tolerancia de 0.01 para redondeo
    if (Math.abs(totalAmount - orderTotal) > 0.01) {
      throw new AppError('SPLIT_PAYMENT_AMOUNT_MISMATCH',
        `Split payments must sum to order total. Expected: ${orderTotal}, Got: ${totalAmount}`);
    }

    // 4. Create PaymentDifferentiation
    const paymentDiff = await this.paymentDiffRepository.create({
      orderId: order.id,
      firstPaymentAmount: input.firstPayment.amount,
      firstPaymentMethod: input.firstPayment.paymentMethod,
      secondPaymentAmount: input.secondPayment.amount,
      secondPaymentMethod: input.secondPayment.paymentMethod,
    });

    // 5. Create Payments (both SUCCEEDED immediately)
    const payment1 = await this.paymentRepository.create({
      orderId: order.id,
      userId: order.userId,
      amount: input.firstPayment.amount,
      currency: 'USD',
      status: PaymentStatus.SUCCEEDED,
      paymentMethod: input.firstPayment.paymentMethod,
      gateway: null,
    });

    const payment2 = await this.paymentRepository.create({
      orderId: order.id,
      userId: order.userId,
      amount: input.secondPayment.amount,
      currency: 'USD',
      status: PaymentStatus.SUCCEEDED,
      paymentMethod: input.secondPayment.paymentMethod,
      gateway: null,
    });

    // 6. Update Order
    const updatedOrder = await this.orderRepository.update(order.id, {
      status: true,
      paymentDiffer: true,
      paymentMethod: null, // NULL for split payment
    });

    return {
      paymentDifferentiation: {
        id: paymentDiff.id,
        orderId: paymentDiff.orderId,
        firstPaymentAmount: paymentDiff.firstPaymentAmount,
        firstPaymentMethod: paymentDiff.firstPaymentMethod,
        secondPaymentAmount: paymentDiff.secondPaymentAmount,
        secondPaymentMethod: paymentDiff.secondPaymentMethod,
      },
      payments: [
        {
          id: payment1.id,
          amount: payment1.amount,
          status: payment1.status,
          paymentMethod: payment1.paymentMethod,
        },
        {
          id: payment2.id,
          amount: payment2.amount,
          status: payment2.status,
          paymentMethod: payment2.paymentMethod,
        },
      ],
      order: {
        id: updatedOrder.id,
        status: updatedOrder.status,
        paymentDiffer: updatedOrder.paymentDiffer,
        paymentMethod: updatedOrder.paymentMethod,
      },
    };
  }
}

