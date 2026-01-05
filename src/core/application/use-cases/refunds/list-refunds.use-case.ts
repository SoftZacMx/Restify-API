import { inject, injectable } from 'tsyringe';
import { IRefundRepository } from '../../../domain/interfaces/refund-repository.interface';
import { ListRefundsInput } from '../../dto/refund.dto';
import { RefundStatus } from '@prisma/client';

export interface ListRefundsResult {
  id: string;
  paymentId: string;
  amount: number;
  reason: string | null;
  gatewayRefundId: string | null;
  status: RefundStatus;
  createdAt: Date;
}

@injectable()
export class ListRefundsUseCase {
  constructor(
    @inject('IRefundRepository') private readonly refundRepository: IRefundRepository
  ) {}

  async execute(input?: ListRefundsInput): Promise<ListRefundsResult[]> {
    const filters = input
      ? {
          paymentId: input.paymentId,
          status: input.status,
          dateFrom: input.dateFrom ? new Date(input.dateFrom) : undefined,
          dateTo: input.dateTo ? new Date(input.dateTo) : undefined,
        }
      : undefined;

    const refunds = await this.refundRepository.findAll(filters);

    return refunds.map((refund) => ({
      id: refund.id,
      paymentId: refund.paymentId,
      amount: refund.amount,
      reason: refund.reason,
      gatewayRefundId: refund.gatewayRefundId,
      status: refund.status,
      createdAt: refund.createdAt,
    }));
  }
}

