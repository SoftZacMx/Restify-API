import { inject, injectable } from 'tsyringe';
import { ISubscriptionRepository } from '../../../domain/interfaces/subscription-repository.interface';
import { StripeSubscriptionService } from '../../../infrastructure/payment-gateways/stripe-subscription.service';
import { SubscriptionStatus } from '@prisma/client';

export interface VerifySubscriptionCheckoutInput {
  sessionId: string;
}

export interface VerifySubscriptionCheckoutResult {
  status: string;
  verified: boolean;
}

@injectable()
export class VerifySubscriptionCheckoutUseCase {
  constructor(
    @inject('ISubscriptionRepository') private readonly subscriptionRepository: ISubscriptionRepository,
    @inject(StripeSubscriptionService) private readonly stripeSubscriptionService: StripeSubscriptionService
  ) {}

  async execute(input: VerifySubscriptionCheckoutInput): Promise<VerifySubscriptionCheckoutResult> {
    // 1. Obtener checkout session de Stripe
    const session = await this.stripeSubscriptionService.getCheckoutSession(input.sessionId);

    // 2. Si no está pagado o no tiene suscripción, retornar sin cambios
    if (session.paymentStatus !== 'paid' || !session.subscriptionId) {
      return { status: 'PENDING', verified: false };
    }

    // 3. Buscar suscripción local
    const subscription = await this.subscriptionRepository.find();
    if (!subscription) {
      return { status: 'NOT_FOUND', verified: false };
    }

    // 4. Si ya está ACTIVE, no hacer nada (idempotente)
    if (subscription.status === SubscriptionStatus.ACTIVE) {
      return { status: 'ACTIVE', verified: true };
    }

    // 5. Obtener detalles de la suscripción de Stripe
    const stripeSub = await this.stripeSubscriptionService.getSubscription(session.subscriptionId);
    const metadata = await this.stripeSubscriptionService.getSubscriptionMetadata(session.subscriptionId);

    // 6. Actualizar BD
    await this.subscriptionRepository.update(subscription.id, {
      stripeSubscriptionId: session.subscriptionId,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: stripeSub.currentPeriodStart,
      currentPeriodEnd: stripeSub.currentPeriodEnd,
      planId: metadata.planId || subscription.planId,
    });

    return { status: 'ACTIVE', verified: true };
  }
}
