import { HandleSubscriptionWebhookUseCase } from '../../../../src/core/application/use-cases/subscription/handle-subscription-webhook.use-case';
import { ISubscriptionRepository } from '../../../../src/core/domain/interfaces/subscription-repository.interface';
import { StripeSubscriptionService } from '../../../../src/core/infrastructure/payment-gateways/stripe-subscription.service';
import { Subscription } from '../../../../src/core/domain/entities/subscription.entity';
import { SubscriptionStatus } from '@prisma/client';
import Stripe from 'stripe';

describe('HandleSubscriptionWebhookUseCase', () => {
  let useCase: HandleSubscriptionWebhookUseCase;
  let mockSubscriptionRepository: jest.Mocked<ISubscriptionRepository>;
  let mockStripeService: jest.Mocked<StripeSubscriptionService>;

  const now = new Date();
  const periodStart = new Date('2026-03-01');
  const periodEnd = new Date('2026-04-01');

  const existingSub = new Subscription(
    'sub-id-1',
    'cus_test_123',
    'sub_stripe_123',
    SubscriptionStatus.EXPIRED,
    null,
    null,
    false,
    now,
    now
  );

  beforeEach(() => {
    mockSubscriptionRepository = {
      find: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };

    mockStripeService = {
      createCustomer: jest.fn(),
      createCheckoutSession: jest.fn(),
      getSubscription: jest.fn(),
      cancelSubscription: jest.fn(),
      reactivateSubscription: jest.fn(),
      constructWebhookEvent: jest.fn(),
    } as any;

    useCase = new HandleSubscriptionWebhookUseCase(
      mockSubscriptionRepository,
      mockStripeService
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkout.session.completed', () => {
    it('should activate subscription on checkout completed', async () => {
      const event = {
        type: 'checkout.session.completed',
        data: {
          object: {
            customer: 'cus_test_123',
            subscription: 'sub_stripe_123',
          },
        },
      } as unknown as Stripe.Event;

      mockSubscriptionRepository.find.mockResolvedValue(existingSub);
      mockStripeService.getSubscription.mockResolvedValue({
        id: 'sub_stripe_123',
        status: 'active',
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
      });
      mockSubscriptionRepository.update.mockResolvedValue(existingSub);

      await useCase.execute({ event });

      expect(mockSubscriptionRepository.update).toHaveBeenCalledWith('sub-id-1', {
        stripeSubscriptionId: 'sub_stripe_123',
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
      });
    });

    it('should do nothing if no local subscription found', async () => {
      const event = {
        type: 'checkout.session.completed',
        data: {
          object: {
            customer: 'cus_unknown',
            subscription: 'sub_stripe_999',
          },
        },
      } as unknown as Stripe.Event;

      mockSubscriptionRepository.find.mockResolvedValue(null);
      mockStripeService.getSubscription.mockResolvedValue({
        id: 'sub_stripe_999',
        status: 'active',
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
      });

      await useCase.execute({ event });

      expect(mockSubscriptionRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('invoice.paid', () => {
    it('should renew subscription period on invoice paid', async () => {
      const activeSub = new Subscription(
        'sub-id-1',
        'cus_test_123',
        'sub_stripe_123',
        SubscriptionStatus.ACTIVE,
        periodStart,
        periodEnd,
        false,
        now,
        now
      );

      const newPeriodEnd = new Date('2026-05-01');

      const event = {
        type: 'invoice.paid',
        data: {
          object: {
            subscription: 'sub_stripe_123',
          },
        },
      } as unknown as Stripe.Event;

      mockSubscriptionRepository.find.mockResolvedValue(activeSub);
      mockStripeService.getSubscription.mockResolvedValue({
        id: 'sub_stripe_123',
        status: 'active',
        currentPeriodStart: periodEnd,
        currentPeriodEnd: newPeriodEnd,
        cancelAtPeriodEnd: false,
      });
      mockSubscriptionRepository.update.mockResolvedValue(activeSub);

      await useCase.execute({ event });

      expect(mockSubscriptionRepository.update).toHaveBeenCalledWith('sub-id-1', {
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: periodEnd,
        currentPeriodEnd: newPeriodEnd,
      });
    });

    it('should ignore if subscription id does not match', async () => {
      const activeSub = new Subscription(
        'sub-id-1',
        'cus_test_123',
        'sub_stripe_OTHER',
        SubscriptionStatus.ACTIVE,
        periodStart,
        periodEnd,
        false,
        now,
        now
      );

      const event = {
        type: 'invoice.paid',
        data: {
          object: {
            subscription: 'sub_stripe_123',
          },
        },
      } as unknown as Stripe.Event;

      mockSubscriptionRepository.find.mockResolvedValue(activeSub);

      await useCase.execute({ event });

      expect(mockSubscriptionRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('invoice.payment_failed', () => {
    it('should set status to PAST_DUE on payment failure', async () => {
      const activeSub = new Subscription(
        'sub-id-1',
        'cus_test_123',
        'sub_stripe_123',
        SubscriptionStatus.ACTIVE,
        periodStart,
        periodEnd,
        false,
        now,
        now
      );

      const event = {
        type: 'invoice.payment_failed',
        data: {
          object: {
            subscription: 'sub_stripe_123',
          },
        },
      } as unknown as Stripe.Event;

      mockSubscriptionRepository.find.mockResolvedValue(activeSub);
      mockSubscriptionRepository.update.mockResolvedValue(activeSub);

      await useCase.execute({ event });

      expect(mockSubscriptionRepository.update).toHaveBeenCalledWith('sub-id-1', {
        status: SubscriptionStatus.PAST_DUE,
      });
    });
  });

  describe('customer.subscription.updated', () => {
    it('should sync subscription state from Stripe', async () => {
      const activeSub = new Subscription(
        'sub-id-1',
        'cus_test_123',
        'sub_stripe_123',
        SubscriptionStatus.ACTIVE,
        periodStart,
        periodEnd,
        false,
        now,
        now
      );

      const event = {
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_stripe_123',
            status: 'active',
            cancel_at_period_end: true,
            current_period_start: Math.floor(periodStart.getTime() / 1000),
            current_period_end: Math.floor(periodEnd.getTime() / 1000),
          },
        },
      } as unknown as Stripe.Event;

      mockSubscriptionRepository.find.mockResolvedValue(activeSub);
      mockSubscriptionRepository.update.mockResolvedValue(activeSub);

      await useCase.execute({ event });

      expect(mockSubscriptionRepository.update).toHaveBeenCalledWith('sub-id-1', {
        status: SubscriptionStatus.ACTIVE,
        cancelAtPeriodEnd: true,
        currentPeriodStart: expect.any(Date),
        currentPeriodEnd: expect.any(Date),
      });
    });
  });

  describe('customer.subscription.deleted', () => {
    it('should set status to CANCELED', async () => {
      const activeSub = new Subscription(
        'sub-id-1',
        'cus_test_123',
        'sub_stripe_123',
        SubscriptionStatus.ACTIVE,
        periodStart,
        periodEnd,
        true,
        now,
        now
      );

      const event = {
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub_stripe_123',
            status: 'canceled',
            cancel_at_period_end: false,
            current_period_start: Math.floor(periodStart.getTime() / 1000),
            current_period_end: Math.floor(periodEnd.getTime() / 1000),
          },
        },
      } as unknown as Stripe.Event;

      mockSubscriptionRepository.find.mockResolvedValue(activeSub);
      mockSubscriptionRepository.update.mockResolvedValue(activeSub);

      await useCase.execute({ event });

      expect(mockSubscriptionRepository.update).toHaveBeenCalledWith('sub-id-1', {
        status: SubscriptionStatus.CANCELED,
      });
    });
  });
});
