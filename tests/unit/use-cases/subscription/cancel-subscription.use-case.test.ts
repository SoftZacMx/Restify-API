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

  it('should throw error when subscription has no stripe subscription id', async () => {
    const noStripeSub = new Subscription(
      'sub-id-1',
      'cus_test_123',
      null, // no stripeSubscriptionId
      SubscriptionStatus.ACTIVE,
      new Date(),
      periodEnd,
      false,
      null,
      new Date(),
      new Date()
    );

    mockSubscriptionRepository.find.mockResolvedValue(noStripeSub);

    try {
      await useCase.execute();
      fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe('SUBSCRIPTION_NOT_ACTIVE');
    }
  });
});
