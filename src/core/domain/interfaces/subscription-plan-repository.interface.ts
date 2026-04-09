import { SubscriptionPlan } from '../entities/subscription-plan.entity';

export interface ISubscriptionPlanRepository {
  findAll(): Promise<SubscriptionPlan[]>;
  findActive(): Promise<SubscriptionPlan[]>;
  findById(id: string): Promise<SubscriptionPlan | null>;
  findByStripePriceId(stripePriceId: string): Promise<SubscriptionPlan | null>;
}
