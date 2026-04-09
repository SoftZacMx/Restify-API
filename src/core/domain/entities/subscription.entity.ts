import { SubscriptionStatus } from '@prisma/client';

export class Subscription {
  constructor(
    public readonly id: string,
    public readonly stripeCustomerId: string,
    public readonly stripeSubscriptionId: string | null,
    public readonly status: SubscriptionStatus,
    public readonly currentPeriodStart: Date | null,
    public readonly currentPeriodEnd: Date | null,
    public readonly cancelAtPeriodEnd: boolean,
    public readonly planId: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}
}
