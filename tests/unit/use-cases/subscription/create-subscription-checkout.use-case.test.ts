import { CreateSubscriptionCheckoutUseCase } from '../../../../src/core/application/use-cases/subscription/create-subscription-checkout.use-case';
import { ISubscriptionRepository } from '../../../../src/core/domain/interfaces/subscription-repository.interface';
import { ICompanyRepository } from '../../../../src/core/domain/interfaces/company-repository.interface';
import { IUserRepository } from '../../../../src/core/domain/interfaces/user-repository.interface';
import { StripeSubscriptionService } from '../../../../src/core/infrastructure/payment-gateways/stripe-subscription.service';
import { Subscription } from '../../../../src/core/domain/entities/subscription.entity';
import { User } from '../../../../src/core/domain/entities/user.entity';
import { Company } from '../../../../src/core/domain/entities/company.entity';
import { SubscriptionStatus, UserRole } from '@prisma/client';
import { AppError } from '../../../../src/shared/errors';

describe('CreateSubscriptionCheckoutUseCase', () => {
  let useCase: CreateSubscriptionCheckoutUseCase;
  let mockSubscriptionRepository: jest.Mocked<ISubscriptionRepository>;
  let mockCompanyRepository: jest.Mocked<ICompanyRepository>;
  let mockUserRepository: jest.Mocked<IUserRepository>;
  let mockStripeService: jest.Mocked<StripeSubscriptionService>;

  const originalEnv = process.env;

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
    new Date(),
    new Date()
  );

  const mockCompany = new Company(
    'company-1',
    'Mi Restaurante',
    'State',
    'City',
    'Street',
    '123',
    '5551234567',
    null,
    null,
    null,
    null,
    null,
    new Date(),
    new Date()
  );

  beforeEach(() => {
    process.env = { ...originalEnv, STRIPE_PRICE_ID: 'price_test_123' };

    mockSubscriptionRepository = {
      find: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };

    mockCompanyRepository = {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };

    mockUserRepository = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findAll: jest.fn(),
      reactivate: jest.fn(),
    };

    mockStripeService = {
      createCustomer: jest.fn(),
      createCheckoutSession: jest.fn(),
      getSubscription: jest.fn(),
      cancelSubscription: jest.fn(),
      reactivateSubscription: jest.fn(),
      constructWebhookEvent: jest.fn(),
    } as any;

    useCase = new CreateSubscriptionCheckoutUseCase(
      mockSubscriptionRepository,
      mockCompanyRepository,
      mockUserRepository,
      mockStripeService
    );
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  const input = {
    userId: 'user-admin-1',
  };

  it('should create checkout session for new subscription', async () => {
    mockUserRepository.findById.mockResolvedValue(mockAdminUser);
    mockCompanyRepository.findFirst.mockResolvedValue(mockCompany);
    mockSubscriptionRepository.find.mockResolvedValue(null);
    mockStripeService.createCustomer.mockResolvedValue('cus_test_123');
    mockStripeService.createCheckoutSession.mockResolvedValue({
      sessionId: 'cs_test_123',
      url: 'https://checkout.stripe.com/cs_test_123',
    });
    mockSubscriptionRepository.create.mockResolvedValue(
      new Subscription(
        'sub-id-1',
        'cus_test_123',
        null,
        SubscriptionStatus.EXPIRED,
        null,
        null,
        false,
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
    expect(mockSubscriptionRepository.create).toHaveBeenCalledWith({
      stripeCustomerId: 'cus_test_123',
    });
  });

  it('should reuse existing stripe customer when subscription exists but is not active', async () => {
    const existingSub = new Subscription(
      'sub-id-1',
      'cus_existing_123',
      null,
      SubscriptionStatus.EXPIRED,
      null,
      null,
      false,
      new Date(),
      new Date()
    );

    mockUserRepository.findById.mockResolvedValue(mockAdminUser);
    mockCompanyRepository.findFirst.mockResolvedValue(mockCompany);
    mockSubscriptionRepository.find.mockResolvedValue(existingSub);
    mockStripeService.createCheckoutSession.mockResolvedValue({
      sessionId: 'cs_test_456',
      url: 'https://checkout.stripe.com/cs_test_456',
    });

    const result = await useCase.execute(input);

    expect(result.checkoutUrl).toBe('https://checkout.stripe.com/cs_test_456');
    expect(mockStripeService.createCustomer).not.toHaveBeenCalled();
    expect(mockSubscriptionRepository.create).not.toHaveBeenCalled();
    expect(mockStripeService.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: 'cus_existing_123' })
    );
  });

  it('should throw error when subscription is already active', async () => {
    const activeSub = new Subscription(
      'sub-id-1',
      'cus_test_123',
      'sub_test_123',
      SubscriptionStatus.ACTIVE,
      new Date(),
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      false,
      new Date(),
      new Date()
    );

    mockUserRepository.findById.mockResolvedValue(mockAdminUser);
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

  it('should throw error when STRIPE_PRICE_ID is not configured', async () => {
    delete process.env.STRIPE_PRICE_ID;
    mockUserRepository.findById.mockResolvedValue(mockAdminUser);

    try {
      await useCase.execute(input);
      fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe('SUBSCRIPTION_PRICE_NOT_CONFIGURED');
    }
  });
});
