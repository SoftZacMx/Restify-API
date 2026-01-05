import { inject, injectable } from 'tsyringe';
import { IPaymentRepository } from '../../../domain/interfaces/payment-repository.interface';
import { ListPaymentsInput } from '../../dto/payment.dto';
import { PaymentStatus, PaymentMethod } from '@prisma/client';

export interface ListPaymentsResult {
  id: string;
  orderId: string | null;
  userId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paymentMethod: PaymentMethod;
  gateway: string | null;
  gatewayTransactionId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@injectable()
export class ListPaymentsUseCase {
  constructor(
    @inject('IPaymentRepository') private readonly paymentRepository: IPaymentRepository
  ) {}

  async execute(input?: ListPaymentsInput): Promise<ListPaymentsResult[]> {
    const filters = input
      ? {
          orderId: input.orderId,
          userId: input.userId,
          status: input.status,
          paymentMethod: input.paymentMethod,
          dateFrom: input.dateFrom ? new Date(input.dateFrom) : undefined,
          dateTo: input.dateTo ? new Date(input.dateTo) : undefined,
        }
      : undefined;

    const payments = await this.paymentRepository.findAll(filters);

    return payments.map((payment) => ({
      id: payment.id,
      orderId: payment.orderId,
      userId: payment.userId,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      paymentMethod: payment.paymentMethod,
      gateway: payment.gateway,
      gatewayTransactionId: payment.gatewayTransactionId,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    }));
  }
}

