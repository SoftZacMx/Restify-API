import { inject, injectable } from 'tsyringe';
import { SubscriptionStatus } from '@prisma/client';
import { ISubscriptionRepository } from '../../../domain/interfaces/subscription-repository.interface';
import { ISubscriptionPlanRepository } from '../../../domain/interfaces/subscription-plan-repository.interface';

export interface SubscriptionPlanInfo {
  id: string;
  name: string;
  billingPeriod: string;
  price: number;
}

export interface GetSubscriptionStatusResult {
  exists: boolean;
  status: SubscriptionStatus | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  isActive: boolean;
  daysRemaining: number | null;
  plan: SubscriptionPlanInfo | null;
}

@injectable()
export class GetSubscriptionStatusUseCase {
  constructor(
    @inject('ISubscriptionRepository') private readonly subscriptionRepository: ISubscriptionRepository,
    @inject('ISubscriptionPlanRepository') private readonly planRepository: ISubscriptionPlanRepository
  ) {}

  async execute(): Promise<GetSubscriptionStatusResult> {
    const subscription = await this.subscriptionRepository.find();

    if (!subscription) {
      return {
        exists: false,
        status: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        isActive: false,
        daysRemaining: null,
        plan: null,
      };
    }

    const now = new Date();
    const hasValidPeriod = !!subscription.currentPeriodEnd && subscription.currentPeriodEnd > now;
    const isActive = (subscription.status === SubscriptionStatus.ACTIVE ||
                     subscription.status === SubscriptionStatus.TRIALING) && hasValidPeriod;

    let daysRemaining: number | null = null;
    if (subscription.currentPeriodEnd) {
      const now = new Date();
      const diff = subscription.currentPeriodEnd.getTime() - now.getTime();
      daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    }

    // Obtener info del plan si existe
    let plan: SubscriptionPlanInfo | null = null;
    if (subscription.planId) {
      const planEntity = await this.planRepository.findById(subscription.planId);
      if (planEntity) {
        plan = {
          id: planEntity.id,
          name: planEntity.name,
          billingPeriod: planEntity.billingPeriod,
          price: planEntity.price,
        };
      }
    }

    return {
      exists: true,
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      isActive,
      daysRemaining,
      plan,
    };
  }
}
