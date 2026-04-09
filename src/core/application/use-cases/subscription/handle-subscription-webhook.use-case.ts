import { inject, injectable } from 'tsyringe';
import Stripe from 'stripe';
import { ISubscriptionRepository } from '../../../domain/interfaces/subscription-repository.interface';
import { StripeSubscriptionService } from '../../../infrastructure/payment-gateways/stripe-subscription.service';
import { SubscriptionStatus } from '@prisma/client';

export interface HandleSubscriptionWebhookInput {
  event: Stripe.Event;
}

@injectable()
export class HandleSubscriptionWebhookUseCase {
  constructor(
    @inject('ISubscriptionRepository') private readonly subscriptionRepository: ISubscriptionRepository,
    @inject(StripeSubscriptionService) private readonly stripeSubscriptionService: StripeSubscriptionService
  ) {}

  async execute(input: HandleSubscriptionWebhookInput): Promise<void> {
    const { event } = input;

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event);
        break;
      case 'invoice.paid':
        await this.handleInvoicePaid(event);
        break;
      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(event);
        break;
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event);
        break;
    }
  }

  private async handleCheckoutCompleted(event: Stripe.Event): Promise<void> {
    const session = event.data.object as Stripe.Checkout.Session;
    const stripeSubscriptionId = session.subscription as string;

    if (!stripeSubscriptionId) return;

    // Obtener detalles de la suscripción de Stripe
    const stripeSub = await this.stripeSubscriptionService.getSubscription(stripeSubscriptionId);

    // Buscar registro local por customerId
    const subscription = await this.subscriptionRepository.find();
    if (!subscription) return;

    // Obtener planId desde metadata de la suscripción de Stripe
    const stripeSubFull = await this.stripeSubscriptionService.getSubscriptionMetadata(stripeSubscriptionId);
    const planId = stripeSubFull?.planId || subscription.planId;

    await this.subscriptionRepository.update(subscription.id, {
      stripeSubscriptionId,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: stripeSub.currentPeriodStart,
      currentPeriodEnd: stripeSub.currentPeriodEnd,
      planId,
    });
  }

  private async handleInvoicePaid(event: Stripe.Event): Promise<void> {
    const invoice = event.data.object as Stripe.Invoice;
    const stripeSubscriptionId = invoice.subscription as string;

    if (!stripeSubscriptionId) return;

    const stripeSub = await this.stripeSubscriptionService.getSubscription(stripeSubscriptionId);

    const subscription = await this.subscriptionRepository.find();
    if (!subscription || subscription.stripeSubscriptionId !== stripeSubscriptionId) return;

    await this.subscriptionRepository.update(subscription.id, {
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: stripeSub.currentPeriodStart,
      currentPeriodEnd: stripeSub.currentPeriodEnd,
    });
  }

  private async handleInvoicePaymentFailed(event: Stripe.Event): Promise<void> {
    const invoice = event.data.object as Stripe.Invoice;
    const stripeSubscriptionId = invoice.subscription as string;

    if (!stripeSubscriptionId) return;

    const subscription = await this.subscriptionRepository.find();
    if (!subscription || subscription.stripeSubscriptionId !== stripeSubscriptionId) return;

    await this.subscriptionRepository.update(subscription.id, {
      status: SubscriptionStatus.PAST_DUE,
    });
  }

  private async handleSubscriptionUpdated(event: Stripe.Event): Promise<void> {
    const stripeSub = event.data.object as Stripe.Subscription;

    const subscription = await this.subscriptionRepository.find();
    if (!subscription || subscription.stripeSubscriptionId !== stripeSub.id) return;

    const statusMap: Record<string, SubscriptionStatus> = {
      active: SubscriptionStatus.ACTIVE,
      past_due: SubscriptionStatus.PAST_DUE,
      canceled: SubscriptionStatus.CANCELED,
      trialing: SubscriptionStatus.TRIALING,
    };

    await this.subscriptionRepository.update(subscription.id, {
      status: statusMap[stripeSub.status] || subscription.status,
      cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
      currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
    });
  }

  private async handleSubscriptionDeleted(event: Stripe.Event): Promise<void> {
    const stripeSub = event.data.object as Stripe.Subscription;

    const subscription = await this.subscriptionRepository.find();
    if (!subscription || subscription.stripeSubscriptionId !== stripeSub.id) return;

    await this.subscriptionRepository.update(subscription.id, {
      status: SubscriptionStatus.CANCELED,
    });
  }
}
