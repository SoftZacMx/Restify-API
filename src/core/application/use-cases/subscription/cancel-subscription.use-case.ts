import { inject, injectable } from 'tsyringe';
import { ISubscriptionRepository } from '../../../domain/interfaces/subscription-repository.interface';
import { StripeSubscriptionService } from '../../../infrastructure/payment-gateways/stripe-subscription.service';
import { AppError } from '../../../../shared/errors';

export interface CancelSubscriptionResult {
  message: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
}

@injectable()
export class CancelSubscriptionUseCase {
  constructor(
    @inject('ISubscriptionRepository') private readonly subscriptionRepository: ISubscriptionRepository,
    @inject(StripeSubscriptionService) private readonly stripeSubscriptionService: StripeSubscriptionService
  ) {}

  async execute(): Promise<CancelSubscriptionResult> {
    const subscription = await this.subscriptionRepository.find();

    if (!subscription) {
      throw new AppError('SUBSCRIPTION_NOT_FOUND');
    }

    if (subscription.status !== 'ACTIVE' && subscription.status !== 'TRIALING') {
      throw new AppError('SUBSCRIPTION_NOT_CANCELABLE');
    }

    if (!subscription.stripeSubscriptionId) {
      throw new AppError('SUBSCRIPTION_NOT_ACTIVE');
    }

    // Cancelar al final del período en Stripe
    await this.stripeSubscriptionService.cancelSubscription(subscription.stripeSubscriptionId);

    // Actualizar en BD
    const updated = await this.subscriptionRepository.update(subscription.id, {
      cancelAtPeriodEnd: true,
    });

    return {
      message: 'La suscripción se cancelará al final del período actual',
      cancelAtPeriodEnd: true,
      currentPeriodEnd: updated.currentPeriodEnd,
    };
  }
}
