import { inject, injectable } from 'tsyringe';
import { IRefundRepository } from '../../../domain/interfaces/refund-repository.interface';
import { ListRefundsInput } from '../../dto/refund.dto';
import { RefundStatus } from '@prisma/client';
import { BranchTimezoneService } from '../../services/branch-timezone.service';
import { startOfDayInZone, endOfDayInZone } from '../../../../shared/utils/date-range.util';

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
    @inject('IRefundRepository') private readonly refundRepository: IRefundRepository,
    @inject(BranchTimezoneService) private readonly branchTimezoneService: BranchTimezoneService
  ) {}

  async execute(input?: ListRefundsInput): Promise<ListRefundsResult[]> {
    const timezone = await this.branchTimezoneService.get();

    const filters = input
      ? {
          paymentId: input.paymentId,
          status: input.status,
          dateFrom: input.dateFrom ? startOfDayInZone(input.dateFrom, timezone) : undefined,
          dateTo: input.dateTo ? endOfDayInZone(input.dateTo, timezone) : undefined,
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

