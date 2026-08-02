import { CreateSubscriptionCheckoutUseCase } from '../../../../src/core/application/use-cases/subscription/create-subscription-checkout.use-case';
import { ISubscriptionRepository } from '../../../../src/core/domain/interfaces/subscription-repository.interface';
import { ISubscriptionPlanRepository } from '../../../../src/core/domain/interfaces/subscription-plan-repository.interface';
import { IOrganizationRepository, OrganizationRecord } from '../../../../src/core/domain/interfaces/organization-repository.interface';
import { IUserRepository } from '../../../../src/core/domain/interfaces/user-repository.interface';
import { StripeSubscriptionService } from '../../../../src/core/infrastructure/payment-gateways/stripe-subscription.service';
import { Subscription } from '../../../../src/core/domain/entities/subscription.entity';
import { SubscriptionPlan } from '../../../../src/core/domain/entities/subscription-plan.entity';
import { User } from '../../../../src/core/domain/entities/user.entity';
import { SubscriptionStatus, UserRole, BillingPeriod, OrganizationPlan } from '@prisma/client';
import { AppError } from '../../../../src/shared/errors';

describe('CreateSubscriptionCheckoutUseCase', () => {
  let useCase: CreateSubscriptionCheckoutUseCase;
  let mockSubscriptionRepository: jest.Mocked<ISubscriptionRepository>;
  let mockPlanRepository: jest.Mocked<ISubscriptionPlanRepository>;
  let mockOrganizationRepository: jest.Mocked<IOrganizationRepository>;
  let mockUserRepository: jest.Mocked<IUserRepository>;
  let mockStripeService: jest.Mocked<StripeSubscriptionService>;

  const mockAdminUser = new User(
    'user-admin-1',
    'Admin',
    'User',
    null,
    'test@restaurant.com',
    'hashed_password',
    null,
    true,
    UserRole.ADMIN,
    'org-1',
    'ACTIVE',
    0,
    new Date(),
    false,
    new Date(),
    new Date()
  );

  const mockOrganization: OrganizationRecord = {
    id: 'org-1',
    name: 'Mi Restaurante',
    plan: OrganizationPlan.FREE,
    status: 'ACTIVE',
    deletedAt: null,
  };

  const mockPlan = new SubscriptionPlan(
    'plan-monthly-1',
    'Mensual',
    BillingPeriod.MONTHLY,
    322000,
    'price_test_123',
    5,
    true,
    new Date(),
    new Date()
  );

  beforeEach(() => {
    mockSubscriptionRepository = {
      find: jest.fn(),
      findByStripeSubscriptionId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };

    mockPlanRepository = {
      findAll: jest.fn(),
      findActive: jest.fn(),
      findById: jest.fn(),
      findByStripePriceId: jest.fn(),
    };

    mockOrganizationRepository = {
      findById: jest.fn(),
      findFirstActive: jest.fn(),
      findByIdIncludingDeleted: jest.fn(),
      close: jest.fn(),
      reactivate: jest.fn(),
      findUnverifiedOwnerOrgIdsOlderThan: jest.fn(),
    };

    mockUserRepository = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findAll: jest.fn(),
      reactivate: jest.fn(),
      markForPasswordReset: jest.fn(),
      markEmailVerified: jest.fn(),

      changePasswordAndClearFlag: jest.fn(),      changePasswordAndRevokeSessions: jest.fn(),    };

    mockStripeService = {
      createCustomer: jest.fn(),
      createCheckoutSession: jest.fn(),
      getSubscription: jest.fn(),
      getSubscriptionMetadata: jest.fn(),
      cancelSubscription: jest.fn(),
      reactivateSubscription: jest.fn(),
      constructWebhookEvent: jest.fn(),
    } as any;

    useCase = new CreateSubscriptionCheckoutUseCase(
      mockSubscriptionRepository,
      mockPlanRepository,
      mockOrganizationRepository,
      mockUserRepository,
      mockStripeService
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const input = {
    userId: 'user-admin-1',
    planId: 'plan-monthly-1',
  };

  it('should create checkout session for new subscription with plan', async () => {
    mockUserRepository.findById.mockResolvedValue(mockAdminUser);
    mockPlanRepository.findById.mockResolvedValue(mockPlan);
    mockOrganizationRepository.findById.mockResolvedValue(mockOrganization);
    mockSubscriptionRepository.find.mockResolvedValue(null);
    mockStripeService.createCustomer.mockResolvedValue('cus_test_123');
    mockStripeService.createCheckoutSession.mockResolvedValue({
      sessionId: 'cs_test_123',
      url: 'https://checkout.stripe.com/cs_test_123',
    });
    mockSubscriptionRepository.create.mockResolvedValue(
      new Subscription(
        'sub-id-1',
        'org-1',
        'cus_test_123',
        null,
        SubscriptionStatus.EXPIRED,
        null,
        null,
        false,
        'plan-monthly-1',
        new Date(),
        new Date()
      )
    );

    const result = await useCase.execute(input);

    expect(result.checkoutUrl).toBe('https://checkout.stripe.com/cs_test_123');
    expect(result.sessionId).toBe('cs_test_123');
    expect(mockStripeService.createCustomer).toHaveBeenCalledWith({
      email: 'test@restaurant.com',
      name: 'Mi Restaurante',
    });
    expect(mockStripeService.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        priceId: 'price_test_123',
        metadata: { planId: 'plan-monthly-1' },
      })
    );
    expect(mockSubscriptionRepository.create).toHaveBeenCalledWith({
      organizationId: 'org-1',
      stripeCustomerId: 'cus_test_123',
      planId: 'plan-monthly-1',
    });
  });

  it('should reuse existing stripe customer when subscription exists but is not active', async () => {
    const existingSub = new Subscription(
      'sub-id-1',
      'org-1',
      'cus_existing_123',
      null,
      SubscriptionStatus.EXPIRED,
      null,
      null,
      false,
      null,
      new Date(),
      new Date()
    );

    mockUserRepository.findById.mockResolvedValue(mockAdminUser);
    mockPlanRepository.findById.mockResolvedValue(mockPlan);
    mockOrganizationRepository.findById.mockResolvedValue(mockOrganization);
    mockSubscriptionRepository.find.mockResolvedValue(existingSub);
    mockSubscriptionRepository.update.mockResolvedValue(existingSub);
    mockStripeService.createCheckoutSession.mockResolvedValue({
      sessionId: 'cs_test_456',
      url: 'https://checkout.stripe.com/cs_test_456',
    });

    const result = await useCase.execute(input);

    expect(result.checkoutUrl).toBe('https://checkout.stripe.com/cs_test_456');
    expect(mockStripeService.createCustomer).not.toHaveBeenCalled();
    expect(mockSubscriptionRepository.create).not.toHaveBeenCalled();
    expect(mockSubscriptionRepository.update).toHaveBeenCalledWith('sub-id-1', { planId: 'plan-monthly-1' });
    expect(mockStripeService.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: 'cus_existing_123' })
    );
  });

  it('should throw error when subscription is already active', async () => {
    const activeSub = new Subscription(
      'sub-id-1',
      'org-1',
      'cus_test_123',
      'sub_test_123',
      SubscriptionStatus.ACTIVE,
      new Date(),
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      false,
      'plan-monthly-1',
      new Date(),
      new Date()
    );

    mockUserRepository.findById.mockResolvedValue(mockAdminUser);
    mockPlanRepository.findById.mockResolvedValue(mockPlan);
    mockSubscriptionRepository.find.mockResolvedValue(activeSub);

    try {
      await useCase.execute(input);
      fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe('SUBSCRIPTION_ALREADY_ACTIVE');
    }

    expect(mockStripeService.createCheckoutSession).not.toHaveBeenCalled();
  });

  it('should throw error when plan is not found', async () => {
    mockUserRepository.findById.mockResolvedValue(mockAdminUser);
    mockPlanRepository.findById.mockResolvedValue(null);

    try {
      await useCase.execute(input);
      fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe('SUBSCRIPTION_PLAN_NOT_FOUND');
    }
  });
});
