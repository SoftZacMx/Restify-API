import { inject, injectable } from 'tsyringe';
import { IPaymentRepository } from '../../../domain/interfaces/payment-repository.interface';
import { GetPaymentInput } from '../../dto/payment.dto';
import { AppError } from '../../../../shared/errors';

export interface GetPaymentResult {
  id: string;
  orderId: string | null;
  userId: string;
  amount: number;
  currency: string;
  status: string;
  paymentMethod: string;
  gateway: string | null;
  gatewayTransactionId: string | null;
  metadata: any | null;
  createdAt: Date;
  updatedAt: Date;
}

@injectable()
export class GetPaymentUseCase {
  constructor(
    @inject('IPaymentRepository') private readonly paymentRepository: IPaymentRepository
  ) {}

  async execute(input: GetPaymentInput): Promise<GetPaymentResult> {
    const payment = await this.paymentRepository.findById(input.payment_id);

    if (!payment) {
      throw new AppError('PAYMENT_NOT_FOUND');
    }

    return {
      id: payment.id,
      orderId: payment.orderId,
      userId: payment.userId,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      paymentMethod: payment.paymentMethod,
      gateway: payment.gateway,
      gatewayTransactionId: payment.gatewayTransactionId,
      metadata: payment.metadata,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
  }
}

