import Stripe from 'stripe';
import { injectable } from 'tsyringe';

export interface CreatePaymentIntentParams {
  amount: number; // in cents
  currency?: string;
  metadata?: Record<string, string>;
}

export interface PaymentIntentResult {
  id: string;
  client_secret: string;
  status: string;
}

@injectable()
export class StripeService {
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

  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntentResult> {
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: params.amount,
      currency: params.currency || 'usd',
      metadata: params.metadata || {},
      automatic_payment_methods: {
        enabled: true,
      },
    });

    return {
      id: paymentIntent.id,
      client_secret: paymentIntent.client_secret!,
      status: paymentIntent.status,
    };
  }

  async retrievePaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    return await this.stripe.paymentIntents.retrieve(paymentIntentId);
  }

  async confirmPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    return await this.stripe.paymentIntents.confirm(paymentIntentId);
  }

  async createRefund(paymentIntentId: string, amount?: number): Promise<Stripe.Refund> {
    const refundParams: Stripe.RefundCreateParams = {
      payment_intent: paymentIntentId,
    };

    if (amount) {
      refundParams.amount = Math.round(amount * 100); // Convert to cents
    }

    return await this.stripe.refunds.create(refundParams);
  }

  async retrieveRefund(refundId: string): Promise<Stripe.Refund> {
    return await this.stripe.refunds.retrieve(refundId);
  }
}

