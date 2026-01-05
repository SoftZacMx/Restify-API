import { RefundStatus } from '@prisma/client';

export class Refund {
  constructor(
    public readonly id: string,
    public readonly paymentId: string,
    public readonly amount: number,
    public readonly reason: string | null,
    public readonly gatewayRefundId: string | null,
    public readonly status: RefundStatus,
    public readonly createdAt: Date
  ) {}
}

