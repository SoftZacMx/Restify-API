/// <reference types="jest" />

import { SubscriptionRepository } from '../../../src/core/infrastructure/database/repositories/subscription.repository';
import { Subscription } from '../../../src/core/domain/entities/subscription.entity';
import { SubscriptionStatus } from '@prisma/client';

const mockPrismaClient = {
  subscription: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

describe('SubscriptionRepository', () => {
  let repository: SubscriptionRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new SubscriptionRepository(mockPrismaClient as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('find', () => {
    it('should return subscription when found', async () => {
      const mockSubscription = {
        id: 'sub-id-1',
        stripeCustomerId: 'cus_test_123',
        stripeSubscriptionId: 'sub_test_123',
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaClient.subscription.findFirst.mockResolvedValue(mockSubscription);

      const result = await repository.find();

      expect(result).toBeInstanceOf(Subscription);
      expect(result?.id).toBe('sub-id-1');
      expect(result?.stripeCustomerId).toBe('cus_test_123');
      expect(result?.status).toBe(SubscriptionStatus.ACTIVE);
      expect(mockPrismaClient.subscription.findFirst).toHaveBeenCalled();
    });

    it('should return null when no subscription found', async () => {
      mockPrismaClient.subscription.findFirst.mockResolvedValue(null);

      const result = await repository.find();

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create a new subscription', async () => {
      const createData = {
        stripeCustomerId: 'cus_test_123',
      };

      const mockCreated = {
        id: 'sub-id-1',
        stripeCustomerId: 'cus_test_123',
        stripeSubscriptionId: null,
        status: SubscriptionStatus.EXPIRED,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaClient.subscription.create.mockResolvedValue(mockCreated);

      const result = await repository.create(createData);

      expect(result).toBeInstanceOf(Subscription);
      expect(result.stripeCustomerId).toBe('cus_test_123');
      expect(result.status).toBe(SubscriptionStatus.EXPIRED);
      expect(mockPrismaClient.subscription.create).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update subscription status', async () => {
      const updateData = {
        status: SubscriptionStatus.ACTIVE,
        stripeSubscriptionId: 'sub_test_456',
      };

      const mockUpdated = {
        id: 'sub-id-1',
        stripeCustomerId: 'cus_test_123',
        stripeSubscriptionId: 'sub_test_456',
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaClient.subscription.update.mockResolvedValue(mockUpdated);

      const result = await repository.update('sub-id-1', updateData);

      expect(result).toBeInstanceOf(Subscription);
      expect(result.status).toBe(SubscriptionStatus.ACTIVE);
      expect(result.stripeSubscriptionId).toBe('sub_test_456');
      expect(mockPrismaClient.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-id-1' },
        data: updateData,
      });
    });

    it('should only update provided fields', async () => {
      const updateData = {
        cancelAtPeriodEnd: true,
      };

      const mockUpdated = {
        id: 'sub-id-1',
        stripeCustomerId: 'cus_test_123',
        stripeSubscriptionId: 'sub_test_123',
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaClient.subscription.update.mockResolvedValue(mockUpdated);

      const result = await repository.update('sub-id-1', updateData);

      expect(result.cancelAtPeriodEnd).toBe(true);
      expect(mockPrismaClient.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-id-1' },
        data: { cancelAtPeriodEnd: true },
      });
    });
  });
});
