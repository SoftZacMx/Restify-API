import { BillingPeriod } from '@prisma/client';

export class SubscriptionPlan {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly billingPeriod: BillingPeriod | null,
    public readonly price: number,
    public readonly stripePriceId: string | null,
    public readonly maxBranches: number,
    public readonly status: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}
}
