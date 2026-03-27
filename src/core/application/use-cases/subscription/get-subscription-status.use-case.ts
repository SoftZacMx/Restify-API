import { inject, injectable } from 'tsyringe';
import { SubscriptionStatus } from '@prisma/client';
import { ISubscriptionRepository } from '../../../domain/interfaces/subscription-repository.interface';

export interface GetSubscriptionStatusResult {
  exists: boolean;
  status: SubscriptionStatus | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  isActive: boolean;
  daysRemaining: number | null;
}

@injectable()
export class GetSubscriptionStatusUseCase {
  constructor(
    @inject('ISubscriptionRepository') private readonly subscriptionRepository: ISubscriptionRepository
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
      };
    }

    const isActive = subscription.status === SubscriptionStatus.ACTIVE ||
                     subscription.status === SubscriptionStatus.TRIALING;

    let daysRemaining: number | null = null;
    if (subscription.currentPeriodEnd) {
      const now = new Date();
      const diff = subscription.currentPeriodEnd.getTime() - now.getTime();
      daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    }

    return {
      exists: true,
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      isActive,
      daysRemaining,
    };
  }
}
