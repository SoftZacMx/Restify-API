import Stripe from 'stripe';
import { injectable } from 'tsyringe';

export interface CreateCustomerParams {
  email: string;
  name: string;
  metadata?: Record<string, string>;
}

export interface CreateCheckoutSessionParams {
  customerId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  trialDays?: number;
  metadata?: Record<string, string>;
}

export interface CheckoutSessionResult {
  sessionId: string;
  url: string;
}

export interface StripeSubscriptionResult {
  id: string;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
}

@injectable()
export class StripeSubscriptionService {
  private stripe: Stripe;

  constructor() {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }
    this.stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
    });
  }

  async createCustomer(params: CreateCustomerParams): Promise<string> {
    const customer = await this.stripe.customers.create({
      email: params.email,
      name: params.name,
      metadata: params.metadata || {},
    });

    return customer.id;
  }

  async createCheckoutSession(params: CreateCheckoutSessionParams): Promise<CheckoutSessionResult> {
    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      customer: params.customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: params.priceId,
          quantity: 1,
        },
      ],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
    };

    if (params.trialDays || params.metadata) {
      sessionConfig.subscription_data = {};
      if (params.trialDays) {
        sessionConfig.subscription_data.trial_period_days = params.trialDays;
      }
      if (params.metadata) {
        sessionConfig.subscription_data.metadata = params.metadata;
      }
    }

    const session = await this.stripe.checkout.sessions.create(sessionConfig);

    return {
      sessionId: session.id,
      url: session.url!,
    };
  }

  async getSubscription(subscriptionId: string): Promise<StripeSubscriptionResult> {
    const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);

    return {
      id: subscription.id,
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    };
  }

  async getSubscriptionMetadata(subscriptionId: string): Promise<{ planId: string | null }> {
    const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
    return {
      planId: (subscription.metadata?.planId as string) || null,
    };
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    await this.stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
  }

  async reactivateSubscription(subscriptionId: string): Promise<void> {
    await this.stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    });
  }

  constructWebhookEvent(payload: string, signature: string): Stripe.Event {
    const secret = process.env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET;
    if (!secret) {
      throw new Error('STRIPE_SUBSCRIPTION_WEBHOOK_SECRET is required');
    }
    return this.stripe.webhooks.constructEvent(payload, signature, secret);
  }
}
