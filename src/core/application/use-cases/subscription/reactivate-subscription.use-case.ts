import { inject, injectable } from 'tsyringe';
import { ISubscriptionRepository } from '../../../domain/interfaces/subscription-repository.interface';
import { StripeSubscriptionService } from '../../../infrastructure/payment-gateways/stripe-subscription.service';
import { AppError } from '../../../../shared/errors';

export interface ReactivateSubscriptionResult {
  message: string;
  cancelAtPeriodEnd: boolean;
}

@injectable()
export class ReactivateSubscriptionUseCase {
  constructor(
    @inject('ISubscriptionRepository') private readonly subscriptionRepository: ISubscriptionRepository,
    @inject(StripeSubscriptionService) private readonly stripeSubscriptionService: StripeSubscriptionService
  ) {}

  async execute(): Promise<ReactivateSubscriptionResult> {
    const subscription = await this.subscriptionRepository.find();

    if (!subscription) {
      throw new AppError('SUBSCRIPTION_NOT_FOUND');
    }

    if (subscription.status !== 'ACTIVE' || !subscription.cancelAtPeriodEnd) {
      throw new AppError('SUBSCRIPTION_NOT_REACTIVATABLE');
    }

    if (!subscription.stripeSubscriptionId) {
      throw new AppError('SUBSCRIPTION_NOT_ACTIVE');
    }

    // Reactivar en Stripe
    await this.stripeSubscriptionService.reactivateSubscription(subscription.stripeSubscriptionId);

    // Actualizar en BD
    await this.subscriptionRepository.update(subscription.id, {
      cancelAtPeriodEnd: false,
    });

    return {
      message: 'La suscripción ha sido reactivada',
      cancelAtPeriodEnd: false,
    };
  }
}
