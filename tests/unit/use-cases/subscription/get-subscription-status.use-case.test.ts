import { GetSubscriptionStatusUseCase } from '../../../../src/core/application/use-cases/subscription/get-subscription-status.use-case';
import { ISubscriptionRepository } from '../../../../src/core/domain/interfaces/subscription-repository.interface';
import { Subscription } from '../../../../src/core/domain/entities/subscription.entity';
import { SubscriptionStatus } from '@prisma/client';

describe('GetSubscriptionStatusUseCase', () => {
  let useCase: GetSubscriptionStatusUseCase;
  let mockSubscriptionRepository: jest.Mocked<ISubscriptionRepository>;

  beforeEach(() => {
    mockSubscriptionRepository = {
      find: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };

    useCase = new GetSubscriptionStatusUseCase(mockSubscriptionRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return exists: false when no subscription found', async () => {
    mockSubscriptionRepository.find.mockResolvedValue(null);

    const result = await useCase.execute();

    expect(result.exists).toBe(false);
    expect(result.status).toBeNull();
    expect(result.isActive).toBe(false);
    expect(result.daysRemaining).toBeNull();
  });

  it('should return isActive: true for ACTIVE subscription', async () => {
    const futureDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000); // 15 days from now
    const activeSub = new Subscription(
      'sub-id-1',
      'cus_test_123',
      'sub_test_123',
      SubscriptionStatus.ACTIVE,
      new Date(),
      futureDate,
      false,
      new Date(),
      new Date()
    );

    mockSubscriptionRepository.find.mockResolvedValue(activeSub);

    const result = await useCase.execute();

    expect(result.exists).toBe(true);
    expect(result.status).toBe(SubscriptionStatus.ACTIVE);
    expect(result.isActive).toBe(true);
    expect(result.daysRemaining).toBe(15);
    expect(result.cancelAtPeriodEnd).toBe(false);
  });

  it('should return isActive: true for TRIALING subscription', async () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const trialSub = new Subscription(
      'sub-id-1',
      'cus_test_123',
      'sub_test_123',
      SubscriptionStatus.TRIALING,
      new Date(),
      futureDate,
      false,
      new Date(),
      new Date()
    );

    mockSubscriptionRepository.find.mockResolvedValue(trialSub);

    const result = await useCase.execute();

    expect(result.isActive).toBe(true);
    expect(result.daysRemaining).toBe(7);
  });

  it('should return isActive: false for CANCELED subscription', async () => {
    const canceledSub = new Subscription(
      'sub-id-1',
      'cus_test_123',
      'sub_test_123',
      SubscriptionStatus.CANCELED,
      new Date(),
      new Date(Date.now() - 1000),
      false,
      new Date(),
      new Date()
    );

    mockSubscriptionRepository.find.mockResolvedValue(canceledSub);

    const result = await useCase.execute();

    expect(result.exists).toBe(true);
    expect(result.isActive).toBe(false);
    expect(result.daysRemaining).toBe(0);
  });

  it('should return cancelAtPeriodEnd when subscription is pending cancellation', async () => {
    const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    const cancelingSub = new Subscription(
      'sub-id-1',
      'cus_test_123',
      'sub_test_123',
      SubscriptionStatus.ACTIVE,
      new Date(),
      futureDate,
      true, // cancelAtPeriodEnd
      new Date(),
      new Date()
    );

    mockSubscriptionRepository.find.mockResolvedValue(cancelingSub);

    const result = await useCase.execute();

    expect(result.isActive).toBe(true);
    expect(result.cancelAtPeriodEnd).toBe(true);
    expect(result.daysRemaining).toBe(10);
  });
});
