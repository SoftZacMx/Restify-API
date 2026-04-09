import { PrismaClient } from '@prisma/client';
import { ISubscriptionPlanRepository } from '../../../domain/interfaces/subscription-plan-repository.interface';
import { SubscriptionPlan } from '../../../domain/entities/subscription-plan.entity';

export class SubscriptionPlanRepository implements ISubscriptionPlanRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAll(): Promise<SubscriptionPlan[]> {
    const plans = await this.prisma.subscriptionPlan.findMany({
      orderBy: { price: 'asc' },
    });

    return plans.map(this.toEntity);
  }

  async findActive(): Promise<SubscriptionPlan[]> {
    const plans = await this.prisma.subscriptionPlan.findMany({
      where: { status: true },
      orderBy: { price: 'asc' },
    });

    return plans.map(this.toEntity);
  }

  async findById(id: string): Promise<SubscriptionPlan | null> {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id } });
    return plan ? this.toEntity(plan) : null;
  }

  async findByStripePriceId(stripePriceId: string): Promise<SubscriptionPlan | null> {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { stripePriceId } });
    return plan ? this.toEntity(plan) : null;
  }

  private toEntity(plan: {
    id: string;
    name: string;
    billingPeriod: any;
    price: number;
    stripePriceId: string;
    status: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): SubscriptionPlan {
    return new SubscriptionPlan(
      plan.id,
      plan.name,
      plan.billingPeriod,
      plan.price,
      plan.stripePriceId,
      plan.status,
      plan.createdAt,
      plan.updatedAt,
    );
  }
}
