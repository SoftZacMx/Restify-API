import { inject, injectable } from 'tsyringe';
import { PaymentMethod, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/config/prisma.config';
import { PayOrderInput } from '../../dto/payment.dto';
import { AppError } from '../../../../shared/errors';

const PAYMENT_METHOD_TO_ORDER_INT: Record<string, number> = {
  CASH: 1,
  TRANSFER: 2,
  CARD_PHYSICAL: 3,
};

function toPaymentMethodEnum(m: string): PaymentMethod {
  return m === 'CASH' ? PaymentMethod.CASH : m === 'TRANSFER' ? PaymentMethod.TRANSFER : PaymentMethod.CARD_PHYSICAL;
}

export interface PayOrderResult {
  order: {
    id: string;
    status: boolean;
    paymentMethod: number | null;
    delivered: boolean;
  };
  tableReleased: boolean;
  /** Pago único: presente cuando no es pago dividido */
  payment?: {
    id: string;
    orderId: string;
    amount: number;
    status: PaymentStatus;
    paymentMethod: PaymentMethod;
    createdAt: Date;
  };
  /** Pago dividido: presente cuando es split */
  paymentDifferentiation?: {
    id: string;
    orderId: string;
    firstPaymentAmount: number;
    firstPaymentMethod: PaymentMethod;
    secondPaymentAmount: number;
    secondPaymentMethod: PaymentMethod;
  };
  payments?: Array<{
    id: string;
    amount: number;
    status: PaymentStatus;
    paymentMethod: PaymentMethod;
  }>;
}

function isSplitPayment(input: PayOrderInput): input is PayOrderInput & { firstPayment: { amount: number; paymentMethod: string }; secondPayment: { amount: number; paymentMethod: string } } {
  return 'firstPayment' in input && 'secondPayment' in input;
}

@injectable()
export class PayOrderUseCase {
  constructor(
    @inject(PrismaService) private readonly prismaService: PrismaService
  ) {}

  async execute(input: PayOrderInput): Promise<PayOrderResult> {
    if (isSplitPayment(input)) {
      return this.executeSplit(input);
    }
    return this.executeSingle(input);
  }

  private async executeSingle(input: PayOrderInput & { paymentMethod: string; amount: number; transferNumber?: string }): Promise<PayOrderResult> {
    const prisma = this.prismaService.getClient();
    const { orderId, paymentMethod, amount, transferNumber } = input;

    const methodEnum = toPaymentMethodEnum(paymentMethod);
    const orderPaymentMethodInt = PAYMENT_METHOD_TO_ORDER_INT[paymentMethod] ?? 1;

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });

      if (!order) throw new AppError('ORDER_NOT_FOUND');
      if (order.status) throw new AppError('ORDER_ALREADY_PAID');

      const orderTotal = Number(order.total);
      if (Math.abs(amount - orderTotal) > 0.01) {
        throw new AppError('PAYMENT_AMOUNT_MISMATCH', `Amount must match order total. Order total: ${orderTotal}, received: ${amount}`);
      }

      const payment = await tx.payment.create({
        data: {
          orderId: order.id,
          userId: order.userId,
          amount,
          currency: 'USD',
          status: PaymentStatus.SUCCEEDED,
          paymentMethod: methodEnum,
          gateway: null,
          metadata: transferNumber ? { transferNumber } : undefined,
        },
      });

      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          status: true,
          paymentMethod: orderPaymentMethodInt,
          delivered: true,
        },
      });

      let tableReleased = false;
      if (order.tableId && order.origin.toLowerCase() === 'local') {
        await tx.table.update({ where: { id: order.tableId }, data: { availabilityStatus: true } });
        tableReleased = true;
      }

      return { payment, updatedOrder, tableReleased };
    });

    return {
      payment: {
        id: result.payment.id,
        orderId: result.payment.orderId!,
        amount: Number(result.payment.amount),
        status: result.payment.status,
        paymentMethod: result.payment.paymentMethod,
        createdAt: result.payment.createdAt,
      },
      order: {
        id: result.updatedOrder.id,
        status: result.updatedOrder.status,
        paymentMethod: result.updatedOrder.paymentMethod,
        delivered: result.updatedOrder.delivered,
      },
      tableReleased: result.tableReleased,
    };
  }

  private async executeSplit(input: PayOrderInput & { firstPayment: { amount: number; paymentMethod: string }; secondPayment: { amount: number; paymentMethod: string } }): Promise<PayOrderResult> {
    const prisma = this.prismaService.getClient();
    const { orderId, firstPayment, secondPayment } = input;

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });

      if (!order) throw new AppError('ORDER_NOT_FOUND');
      if (order.status) throw new AppError('ORDER_ALREADY_PAID');
      if (order.paymentDiffer) throw new AppError('SPLIT_PAYMENT_ALREADY_EXISTS');

      const orderTotal = Number(order.total);
      const totalAmount = firstPayment.amount + secondPayment.amount;
      if (totalAmount > orderTotal) {
        throw new AppError('SPLIT_PAYMENT_AMOUNT_EXCEEDS_TOTAL', `Total split amount (${totalAmount}) exceeds order total (${orderTotal})`);
      }
      if (Math.abs(totalAmount - orderTotal) > 0.01) {
        throw new AppError('SPLIT_PAYMENT_AMOUNT_MISMATCH', `Split payments must sum to order total. Expected: ${orderTotal}, Got: ${totalAmount}`);
      }

      const method1 = toPaymentMethodEnum(firstPayment.paymentMethod);
      const method2 = toPaymentMethodEnum(secondPayment.paymentMethod);
      if (method1 === method2) {
        throw new AppError('SPLIT_PAYMENT_SAME_METHOD', 'Split payments must use different payment methods');
      }

      const paymentDiff = await tx.paymentDifferentiation.create({
        data: {
          orderId: order.id,
          firstPaymentAmount: firstPayment.amount,
          firstPaymentMethod: method1,
          secondPaymentAmount: secondPayment.amount,
          secondPaymentMethod: method2,
        },
      });

      const payment1 = await tx.payment.create({
        data: {
          orderId: order.id,
          userId: order.userId,
          amount: firstPayment.amount,
          currency: 'USD',
          status: PaymentStatus.SUCCEEDED,
          paymentMethod: method1,
          gateway: null,
        },
      });

      const payment2 = await tx.payment.create({
        data: {
          orderId: order.id,
          userId: order.userId,
          amount: secondPayment.amount,
          currency: 'USD',
          status: PaymentStatus.SUCCEEDED,
          paymentMethod: method2,
          gateway: null,
        },
      });

      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          status: true,
          paymentDiffer: true,
          paymentMethod: null,
          delivered: true,
        },
      });

      let tableReleased = false;
      if (order.tableId && order.origin.toLowerCase() === 'local') {
        await tx.table.update({ where: { id: order.tableId }, data: { availabilityStatus: true } });
        tableReleased = true;
      }

      return {
        paymentDifferentiation: paymentDiff,
        payments: [payment1, payment2],
        updatedOrder,
        tableReleased,
      };
    });

    return {
      order: {
        id: result.updatedOrder.id,
        status: result.updatedOrder.status,
        paymentMethod: result.updatedOrder.paymentMethod,
        delivered: result.updatedOrder.delivered,
      },
      tableReleased: result.tableReleased,
      paymentDifferentiation: {
        id: result.paymentDifferentiation.id,
        orderId: result.paymentDifferentiation.orderId,
        firstPaymentAmount: Number(result.paymentDifferentiation.firstPaymentAmount),
        firstPaymentMethod: result.paymentDifferentiation.firstPaymentMethod,
        secondPaymentAmount: Number(result.paymentDifferentiation.secondPaymentAmount),
        secondPaymentMethod: result.paymentDifferentiation.secondPaymentMethod,
      },
      payments: result.payments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        status: p.status,
        paymentMethod: p.paymentMethod,
      })),
    };
  }
}
