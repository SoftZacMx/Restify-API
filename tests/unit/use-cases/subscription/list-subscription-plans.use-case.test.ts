import { ListSubscriptionPlansUseCase } from '../../../../src/core/application/use-cases/subscription/list-subscription-plans.use-case';
import { ISubscriptionPlanRepository } from '../../../../src/core/domain/interfaces/subscription-plan-repository.interface';
import { SubscriptionPlan } from '../../../../src/core/domain/entities/subscription-plan.entity';
import { BillingPeriod } from '@prisma/client';

describe('ListSubscriptionPlansUseCase', () => {
  let useCase: ListSubscriptionPlansUseCase;
  let mockPlanRepository: jest.Mocked<ISubscriptionPlanRepository>;

  const now = new Date();

  const mockPlans = [
    new SubscriptionPlan('plan-1', 'Mensual', BillingPeriod.MONTHLY, 322000, 'price_monthly', 5, true, now, now),
    new SubscriptionPlan('plan-2', 'Anual', BillingPeriod.ANNUAL, 3112300, 'price_annual', 10, true, now, now),
  ];

  beforeEach(() => {
    mockPlanRepository = {
      findAll: jest.fn(),
      findPublic: jest.fn(),
      findAvailableFor: jest.fn(),
      findById: jest.fn(),
      findByStripePriceId: jest.fn(),
    };

    useCase = new ListSubscriptionPlansUseCase(mockPlanRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return active plans mapped to DTOs', async () => {
    mockPlanRepository.findPublic.mockResolvedValue(mockPlans);

    const result = await useCase.execute();

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: 'plan-1',
      name: 'Mensual',
      billingPeriod: 'MONTHLY',
      price: 322000,
    });
    expect(result[1]).toEqual({
      id: 'plan-2',
      name: 'Anual',
      billingPeriod: 'ANNUAL',
      price: 3112300,
    });
    expect(mockPlanRepository.findPublic).toHaveBeenCalled();
  });

  it('should not include stripePriceId or status in DTOs', async () => {
    mockPlanRepository.findPublic.mockResolvedValue(mockPlans);

    const result = await useCase.execute();

    expect(result[0]).not.toHaveProperty('stripePriceId');
    expect(result[0]).not.toHaveProperty('status');
    expect(result[0]).not.toHaveProperty('createdAt');
  });

  it('should return the plans available for the organization when one is given', async () => {
    mockPlanRepository.findAvailableFor.mockResolvedValue([mockPlans[1]]);

    const result = await useCase.execute('org-1');

    expect(result.map((plan) => plan.id)).toEqual(['plan-2']);
    expect(mockPlanRepository.findAvailableFor).toHaveBeenCalledWith('org-1');
    expect(mockPlanRepository.findPublic).not.toHaveBeenCalled();
  });

  it('should return empty array when no active plans', async () => {
    mockPlanRepository.findPublic.mockResolvedValue([]);

    const result = await useCase.execute();

    expect(result).toEqual([]);
    expect(mockPlanRepository.findPublic).toHaveBeenCalled();
  });
});
