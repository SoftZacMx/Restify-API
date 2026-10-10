import { CancelSubscriptionUseCase } from '../../../../src/core/application/use-cases/subscription/cancel-subscription.use-case';
import { ISubscriptionRepository } from '../../../../src/core/domain/interfaces/subscription-repository.interface';
import { StripeSubscriptionService } from '../../../../src/core/infrastructure/payment-gateways/stripe-subscription.service';
import { Subscription } from '../../../../src/core/domain/entities/subscription.entity';
import { SubscriptionStatus } from '@prisma/client';
import { AppError } from '../../../../src/shared/errors';

describe('CancelSubscriptionUseCase', () => {
  let useCase: CancelSubscriptionUseCase;
  let mockSubscriptionRepository: jest.Mocked<ISubscriptionRepository>;
  let mockStripeService: jest.Mocked<StripeSubscriptionService>;

  beforeEach(() => {
    mockSubscriptionRepository = {
      find: jest.fn(),
      findByStripeSubscriptionId: jest.fn(),
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

    useCase = new CancelSubscriptionUseCase(
      mockSubscriptionRepository,
      mockStripeService
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const periodEnd = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);

  it('should cancel active subscription at period end', async () => {
    const activeSub = new Subscription(
      'sub-id-1',
      'org-1',
      'cus_test_123',
      'sub_test_123',
      SubscriptionStatus.ACTIVE,
      new Date(),
      periodEnd,
      false,
      null,
      new Date(),
      new Date()
    );

    const updatedSub = new Subscription(
      'sub-id-1',
      'org-1',
      'cus_test_123',
      'sub_test_123',
      SubscriptionStatus.ACTIVE,
      new Date(),
      periodEnd,
      true, // cancelAtPeriodEnd
      null,
      new Date(),
      new Date()
    );

    mockSubscriptionRepository.find.mockResolvedValue(activeSub);
    mockStripeService.cancelSubscription.mockResolvedValue(undefined);
    mockSubscriptionRepository.update.mockResolvedValue(updatedSub);

    const result = await useCase.execute();

    expect(result.cancelAtPeriodEnd).toBe(true);
    expect(result.currentPeriodEnd).toEqual(periodEnd);
    expect(mockStripeService.cancelSubscription).toHaveBeenCalledWith('sub_test_123');
    expect(mockSubscriptionRepository.update).toHaveBeenCalledWith('sub-id-1', {
      cancelAtPeriodEnd: true,
    });
  });

  it('should throw error when no subscription found', async () => {
    mockSubscriptionRepository.find.mockResolvedValue(null);

    try {
      await useCase.execute();
      fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe('SUBSCRIPTION_NOT_FOUND');
    }

    expect(mockStripeService.cancelSubscription).not.toHaveBeenCalled();
  });

  it('should throw error when subscription is not active', async () => {
    const expiredSub = new Subscription(
      'sub-id-1',
      'org-1',
      'cus_test_123',
      'sub_test_123',
      SubscriptionStatus.EXPIRED,
      new Date(),
      new Date(Date.now() - 1000),
      false,
      null,
      new Date(),
      new Date()
    );

    mockSubscriptionRepository.find.mockResolvedValue(expiredSub);

    try {
      await useCase.execute();
      fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe('SUBSCRIPTION_NOT_CANCELABLE');
    }
  });

  it('cancels a local trial immediately when there is no stripe subscription yet', async () => {
    const trialingSub = new Subscription(
      'sub-id-1',
      'org-1',
      null, // aún no hay Stripe en el trial local
      null,
      SubscriptionStatus.TRIALING,
      new Date(),
      periodEnd,
      false,
      'plan-monthly-1',
      new Date(),
      new Date()
    );

    const canceledSub = new Subscription(
      'sub-id-1',
      'org-1',
      null,
      null,
      SubscriptionStatus.CANCELED,
      new Date(),
      periodEnd,
      false,
      'plan-monthly-1',
      new Date(),
      new Date()
    );

    mockSubscriptionRepository.find.mockResolvedValue(trialingSub);
    mockSubscriptionRepository.update.mockResolvedValue(canceledSub);

    const result = await useCase.execute();

    expect(result.cancelAtPeriodEnd).toBe(false);
    expect(result.currentPeriodEnd).toEqual(periodEnd);
    expect(mockSubscriptionRepository.update).toHaveBeenCalledWith('sub-id-1', {
      status: SubscriptionStatus.CANCELED,
      cancelAtPeriodEnd: false,
    });
    // El trial local no existe en Stripe: no debe llamarse a Stripe.
    expect(mockStripeService.cancelSubscription).not.toHaveBeenCalled();
  });
});
