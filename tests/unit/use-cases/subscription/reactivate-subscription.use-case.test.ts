import { ReactivateSubscriptionUseCase } from '../../../../src/core/application/use-cases/subscription/reactivate-subscription.use-case';
import { ISubscriptionRepository } from '../../../../src/core/domain/interfaces/subscription-repository.interface';
import { StripeSubscriptionService } from '../../../../src/core/infrastructure/payment-gateways/stripe-subscription.service';
import { Subscription } from '../../../../src/core/domain/entities/subscription.entity';
import { SubscriptionStatus } from '@prisma/client';
import { AppError } from '../../../../src/shared/errors';

describe('ReactivateSubscriptionUseCase', () => {
  let useCase: ReactivateSubscriptionUseCase;
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

    useCase = new ReactivateSubscriptionUseCase(
      mockSubscriptionRepository,
      mockStripeService
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should reactivate a subscription pending cancellation', async () => {
    const cancelingSub = new Subscription(
      'sub-id-1',
      'cus_test_123',
      'sub_test_123',
      SubscriptionStatus.ACTIVE,
      new Date(),
      new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      true, // cancelAtPeriodEnd
      new Date(),
      new Date()
    );

    const reactivatedSub = new Subscription(
      'sub-id-1',
      'cus_test_123',
      'sub_test_123',
      SubscriptionStatus.ACTIVE,
      new Date(),
      new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      false, // cancelAtPeriodEnd = false
      new Date(),
      new Date()
    );

    mockSubscriptionRepository.find.mockResolvedValue(cancelingSub);
    mockStripeService.reactivateSubscription.mockResolvedValue(undefined);
    mockSubscriptionRepository.update.mockResolvedValue(reactivatedSub);

    const result = await useCase.execute();

    expect(result.cancelAtPeriodEnd).toBe(false);
    expect(mockStripeService.reactivateSubscription).toHaveBeenCalledWith('sub_test_123');
    expect(mockSubscriptionRepository.update).toHaveBeenCalledWith('sub-id-1', {
      cancelAtPeriodEnd: false,
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
  });

  it('should throw error when subscription is not pending cancellation', async () => {
    const activeSub = new Subscription(
      'sub-id-1',
      'cus_test_123',
      'sub_test_123',
      SubscriptionStatus.ACTIVE,
      new Date(),
      new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      false, // NOT pending cancellation
      new Date(),
      new Date()
    );

    mockSubscriptionRepository.find.mockResolvedValue(activeSub);

    try {
      await useCase.execute();
      fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe('SUBSCRIPTION_NOT_REACTIVATABLE');
    }
  });

  it('should throw error when subscription is canceled (not just pending)', async () => {
    const canceledSub = new Subscription(
      'sub-id-1',
      'cus_test_123',
      'sub_test_123',
      SubscriptionStatus.CANCELED,
      new Date(),
      new Date(Date.now() - 1000),
      true,
      new Date(),
      new Date()
    );

    mockSubscriptionRepository.find.mockResolvedValue(canceledSub);

    try {
      await useCase.execute();
      fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe('SUBSCRIPTION_NOT_REACTIVATABLE');
    }
  });
});
