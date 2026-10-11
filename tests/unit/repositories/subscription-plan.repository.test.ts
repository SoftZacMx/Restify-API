/// <reference types="jest" />

import { SubscriptionPlanRepository } from '../../../src/core/infrastructure/database/repositories/subscription-plan.repository';
import { SubscriptionPlan } from '../../../src/core/domain/entities/subscription-plan.entity';
import { BillingPeriod } from '@prisma/client';

const now = new Date();

const mockMonthlyPlan = {
  id: 'plan-1',
  name: 'Mensual',
  billingPeriod: BillingPeriod.MONTHLY,
  price: 322000,
  stripePriceId: 'price_monthly',
  status: true,
  createdAt: now,
  updatedAt: now,
};

const mockAnnualPlan = {
  id: 'plan-2',
  name: 'Anual',
  billingPeriod: BillingPeriod.ANNUAL,
  price: 3112300,
  stripePriceId: 'price_annual',
  status: true,
  createdAt: now,
  updatedAt: now,
};

const mockInactivePlan = {
  ...mockMonthlyPlan,
  id: 'plan-3',
  name: 'Descontinuado',
  stripePriceId: 'price_old',
  status: false,
};

const mockPrismaClient = {
  subscriptionPlan: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
};

describe('SubscriptionPlanRepository', () => {
  let repository: SubscriptionPlanRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new SubscriptionPlanRepository(mockPrismaClient as any);
  });

  describe('findAll', () => {
    it('should return all plans as entities', async () => {
      mockPrismaClient.subscriptionPlan.findMany.mockResolvedValue([mockMonthlyPlan, mockAnnualPlan, mockInactivePlan]);

      const result = await repository.findAll();

      expect(result).toHaveLength(3);
      expect(result[0]).toBeInstanceOf(SubscriptionPlan);
      expect(result[0].name).toBe('Mensual');
      expect(mockPrismaClient.subscriptionPlan.findMany).toHaveBeenCalledWith({
        orderBy: { price: 'asc' },
      });
    });

    it('should return empty array when no plans', async () => {
      mockPrismaClient.subscriptionPlan.findMany.mockResolvedValue([]);

      const result = await repository.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findPublic', () => {
    it('should return only active plans without assigned organizations', async () => {
      mockPrismaClient.subscriptionPlan.findMany.mockResolvedValue([mockMonthlyPlan, mockAnnualPlan]);

      const result = await repository.findPublic();

      expect(result).toHaveLength(2);
      expect(result.every((p) => p.status === true)).toBe(true);
      expect(mockPrismaClient.subscriptionPlan.findMany).toHaveBeenCalledWith({
        where: { status: true, restrictedTo: { none: {} } },
        orderBy: { price: 'asc' },
      });
    });
  });

  describe('findAvailableFor', () => {
    it('should return only the plans assigned to the organization', async () => {
      mockPrismaClient.subscriptionPlan.findMany.mockResolvedValueOnce([mockAnnualPlan]);

      const result = await repository.findAvailableFor('org-1');

      expect(result.map((p) => p.id)).toEqual(['plan-2']);
      expect(mockPrismaClient.subscriptionPlan.findMany).toHaveBeenCalledTimes(1);
      expect(mockPrismaClient.subscriptionPlan.findMany).toHaveBeenCalledWith({
        where: { restrictedTo: { some: { organizationId: 'org-1' } } },
        orderBy: { price: 'asc' },
      });
    });

    it('should not return inactive assigned plans nor fall back to public plans', async () => {
      mockPrismaClient.subscriptionPlan.findMany.mockResolvedValueOnce([mockInactivePlan]);

      const result = await repository.findAvailableFor('org-1');

      expect(result).toEqual([]);
      expect(mockPrismaClient.subscriptionPlan.findMany).toHaveBeenCalledTimes(1);
    });

    it('should return public plans when the organization has no assigned plans', async () => {
      mockPrismaClient.subscriptionPlan.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([mockMonthlyPlan]);

      const result = await repository.findAvailableFor('org-2');

      expect(result.map((p) => p.id)).toEqual(['plan-1']);
      expect(mockPrismaClient.subscriptionPlan.findMany).toHaveBeenLastCalledWith({
        where: { status: true, restrictedTo: { none: {} } },
        orderBy: { price: 'asc' },
      });
    });
  });

  describe('findById', () => {
    it('should return plan when found', async () => {
      mockPrismaClient.subscriptionPlan.findUnique.mockResolvedValue(mockMonthlyPlan);

      const result = await repository.findById('plan-1');

      expect(result).toBeInstanceOf(SubscriptionPlan);
      expect(result?.id).toBe('plan-1');
      expect(result?.billingPeriod).toBe(BillingPeriod.MONTHLY);
      expect(mockPrismaClient.subscriptionPlan.findUnique).toHaveBeenCalledWith({
        where: { id: 'plan-1' },
      });
    });

    it('should return null when not found', async () => {
      mockPrismaClient.subscriptionPlan.findUnique.mockResolvedValue(null);

      const result = await repository.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByStripePriceId', () => {
    it('should return plan when found by stripe price id', async () => {
      mockPrismaClient.subscriptionPlan.findUnique.mockResolvedValue(mockAnnualPlan);

      const result = await repository.findByStripePriceId('price_annual');

      expect(result).toBeInstanceOf(SubscriptionPlan);
      expect(result?.stripePriceId).toBe('price_annual');
      expect(result?.price).toBe(3112300);
      expect(mockPrismaClient.subscriptionPlan.findUnique).toHaveBeenCalledWith({
        where: { stripePriceId: 'price_annual' },
      });
    });

    it('should return null when not found', async () => {
      mockPrismaClient.subscriptionPlan.findUnique.mockResolvedValue(null);

      const result = await repository.findByStripePriceId('price_nonexistent');

      expect(result).toBeNull();
    });
  });
});
