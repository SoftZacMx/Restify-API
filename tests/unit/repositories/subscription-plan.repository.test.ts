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

  describe('findActive', () => {
    it('should return only active plans', async () => {
      mockPrismaClient.subscriptionPlan.findMany.mockResolvedValue([mockMonthlyPlan, mockAnnualPlan]);

      const result = await repository.findActive();

      expect(result).toHaveLength(2);
      expect(result.every((p) => p.status === true)).toBe(true);
      expect(mockPrismaClient.subscriptionPlan.findMany).toHaveBeenCalledWith({
        where: { status: true },
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
