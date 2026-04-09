import { BillingPeriod } from '@prisma/client';

export class SubscriptionPlan {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly billingPeriod: BillingPeriod,
    public readonly price: number,
    public readonly stripePriceId: string,
    public readonly status: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}
}
