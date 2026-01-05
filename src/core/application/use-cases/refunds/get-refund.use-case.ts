import { inject, injectable } from 'tsyringe';
import { IRefundRepository } from '../../../domain/interfaces/refund-repository.interface';
import { GetRefundInput } from '../../dto/refund.dto';
import { AppError } from '../../../../shared/errors';

export interface GetRefundResult {
  id: string;
  paymentId: string;
  amount: number;
  reason: string | null;
  gatewayRefundId: string | null;
  status: string;
  createdAt: Date;
}

@injectable()
export class GetRefundUseCase {
  constructor(
    @inject('IRefundRepository') private readonly refundRepository: IRefundRepository
  ) {}

  async execute(input: GetRefundInput): Promise<GetRefundResult> {
    const refund = await this.refundRepository.findById(input.refund_id);

    if (!refund) {
      throw new AppError('REFUND_NOT_FOUND');
    }

    return {
      id: refund.id,
      paymentId: refund.paymentId,
      amount: refund.amount,
      reason: refund.reason,
      gatewayRefundId: refund.gatewayRefundId,
      status: refund.status,
      createdAt: refund.createdAt,
    };
  }
}

