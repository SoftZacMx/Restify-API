import { VerifySubscriptionCheckoutUseCase } from '../../../../src/core/application/use-cases/subscription/verify-subscription-checkout.use-case';
import { ISubscriptionRepository } from '../../../../src/core/domain/interfaces/subscription-repository.interface';
import { StripeSubscriptionService } from '../../../../src/core/infrastructure/payment-gateways/stripe-subscription.service';
import { Subscription } from '../../../../src/core/domain/entities/subscription.entity';
import { SubscriptionStatus } from '@prisma/client';

describe('VerifySubscriptionCheckoutUseCase', () => {
  let useCase: VerifySubscriptionCheckoutUseCase;
  let mockSubscriptionRepository: jest.Mocked<ISubscriptionRepository>;
  let mockStripeService: jest.Mocked<StripeSubscriptionService>;

  const now = new Date();
  const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const makeSubscription = (status: SubscriptionStatus = SubscriptionStatus.EXPIRED) =>
    new Subscription(
      'sub-1', 'cus_abc', 'sub_stripe_1', status,
      now, periodEnd, false, 'plan-1', now, now
    );

  beforeEach(() => {
    mockSubscriptionRepository = {
      find: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };

    mockStripeService = {
      getCheckoutSession: jest.fn(),
      getSubscription: jest.fn(),
      getSubscriptionMetadata: jest.fn(),
      createCustomer: jest.fn(),
      createCheckoutSession: jest.fn(),
      cancelSubscription: jest.fn(),
      reactivateSubscription: jest.fn(),
      constructWebhookEvent: jest.fn(),
    } as any;

    useCase = new VerifySubscriptionCheckoutUseCase(
      mockSubscriptionRepository,
      mockStripeService,
    );
  });

  afterEach(() => jest.clearAllMocks());

  it('should update subscription to ACTIVE when checkout is paid and subscription is EXPIRED', async () => {
    mockStripeService.getCheckoutSession.mockResolvedValue({
      id: 'cs_123',
      paymentStatus: 'paid',
      subscriptionId: 'sub_stripe_new',
      customerId: 'cus_abc',
    });

    mockSubscriptionRepository.find.mockResolvedValue(makeSubscription(SubscriptionStatus.EXPIRED));

    mockStripeService.getSubscription.mockResolvedValue({
      id: 'sub_stripe_new',
      status: 'active',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
    });

    mockStripeService.getSubscriptionMetadata.mockResolvedValue({ planId: 'plan-2' });

    mockSubscriptionRepository.update.mockResolvedValue(makeSubscription(SubscriptionStatus.ACTIVE));

    const result = await useCase.execute({ sessionId: 'cs_123' });

    expect(result).toEqual({ status: 'ACTIVE', verified: true });
    expect(mockSubscriptionRepository.update).toHaveBeenCalledWith('sub-1', {
      stripeSubscriptionId: 'sub_stripe_new',
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      planId: 'plan-2',
    });
  });

  it('should return verified true without updating when subscription is already ACTIVE (idempotent)', async () => {
    mockStripeService.getCheckoutSession.mockResolvedValue({
      id: 'cs_123',
      paymentStatus: 'paid',
      subscriptionId: 'sub_stripe_1',
      customerId: 'cus_abc',
    });

    mockSubscriptionRepository.find.mockResolvedValue(makeSubscription(SubscriptionStatus.ACTIVE));

    const result = await useCase.execute({ sessionId: 'cs_123' });

    expect(result).toEqual({ status: 'ACTIVE', verified: true });
    expect(mockSubscriptionRepository.update).not.toHaveBeenCalled();
    expect(mockStripeService.getSubscription).not.toHaveBeenCalled();
  });

  it('should return PENDING when checkout session is not paid', async () => {
    mockStripeService.getCheckoutSession.mockResolvedValue({
      id: 'cs_123',
      paymentStatus: 'unpaid',
      subscriptionId: null,
      customerId: 'cus_abc',
    });

    const result = await useCase.execute({ sessionId: 'cs_123' });

    expect(result).toEqual({ status: 'PENDING', verified: false });
    expect(mockSubscriptionRepository.find).not.toHaveBeenCalled();
  });

  it('should return NOT_FOUND when no subscription exists in DB', async () => {
    mockStripeService.getCheckoutSession.mockResolvedValue({
      id: 'cs_123',
      paymentStatus: 'paid',
      subscriptionId: 'sub_stripe_new',
      customerId: 'cus_abc',
    });

    mockSubscriptionRepository.find.mockResolvedValue(null);

    const result = await useCase.execute({ sessionId: 'cs_123' });

    expect(result).toEqual({ status: 'NOT_FOUND', verified: false });
    expect(mockSubscriptionRepository.update).not.toHaveBeenCalled();
  });

  it('should return PENDING when session has no subscriptionId', async () => {
    mockStripeService.getCheckoutSession.mockResolvedValue({
      id: 'cs_123',
      paymentStatus: 'paid',
      subscriptionId: null,
      customerId: 'cus_abc',
    });

    const result = await useCase.execute({ sessionId: 'cs_123' });

    expect(result).toEqual({ status: 'PENDING', verified: false });
    expect(mockSubscriptionRepository.find).not.toHaveBeenCalled();
  });
});
