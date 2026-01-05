/// <reference types="jest" />

import { PaymentRepository } from '../../../src/core/infrastructure/database/repositories/payment.repository';
import { Payment } from '../../../src/core/domain/entities/payment.entity';
import { PaymentStatus, PaymentMethod, PaymentGateway } from '@prisma/client';

// Mock Prisma Client
const mockPrismaClient = {
  payment: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

describe('PaymentRepository', () => {
  let repository: PaymentRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new PaymentRepository(mockPrismaClient as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should return a payment when found by id', async () => {
      const mockPayment = {
        id: 'payment-123',
        orderId: 'order-123',
        userId: 'user-123',
        amount: 50.00,
        currency: 'USD',
        status: PaymentStatus.SUCCEEDED,
        paymentMethod: PaymentMethod.CASH,
        gateway: null,
        gatewayTransactionId: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaClient.payment.findUnique.mockResolvedValue(mockPayment);

      const result = await repository.findById('payment-123');

      expect(result).toBeInstanceOf(Payment);
      expect(result?.id).toBe('payment-123');
      expect(result?.status).toBe(PaymentStatus.SUCCEEDED);
      expect(result?.amount).toBe(50.00);
      expect(mockPrismaClient.payment.findUnique).toHaveBeenCalledWith({
        where: { id: 'payment-123' },
      });
    });

    it('should return null when payment not found', async () => {
      mockPrismaClient.payment.findUnique.mockResolvedValue(null);

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findByGatewayTransactionId', () => {
    it('should return a payment when found by gateway transaction id', async () => {
      const mockPayment = {
        id: 'payment-123',
        orderId: 'order-123',
        userId: 'user-123',
        amount: 50.00,
        currency: 'USD',
        status: PaymentStatus.PENDING,
        paymentMethod: PaymentMethod.CARD_STRIPE,
        gateway: PaymentGateway.STRIPE,
        gatewayTransactionId: 'pi_1234567890',
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaClient.payment.findFirst.mockResolvedValue(mockPayment);

      const result = await repository.findByGatewayTransactionId('pi_1234567890');

      expect(result).toBeInstanceOf(Payment);
      expect(result?.gatewayTransactionId).toBe('pi_1234567890');
      expect(mockPrismaClient.payment.findFirst).toHaveBeenCalledWith({
        where: { gatewayTransactionId: 'pi_1234567890' },
      });
    });
  });

  describe('create', () => {
    it('should create a new payment', async () => {
      const paymentData = {
        orderId: 'order-123',
        userId: 'user-123',
        amount: 50.00,
        currency: 'USD',
        status: PaymentStatus.SUCCEEDED,
        paymentMethod: PaymentMethod.CASH,
        gateway: null,
      };

      const mockCreatedPayment = {
        id: 'payment-123',
        ...paymentData,
        gatewayTransactionId: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaClient.payment.create.mockResolvedValue(mockCreatedPayment);

      const result = await repository.create(paymentData);

      expect(result).toBeInstanceOf(Payment);
      expect(result.status).toBe(PaymentStatus.SUCCEEDED);
      expect(result.amount).toBe(50.00);
      expect(mockPrismaClient.payment.create).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update payment status', async () => {
      const updatedData = {
        status: PaymentStatus.SUCCEEDED,
      };

      const mockUpdatedPayment = {
        id: 'payment-123',
        orderId: 'order-123',
        userId: 'user-123',
        amount: 50.00,
        currency: 'USD',
        status: PaymentStatus.SUCCEEDED,
        paymentMethod: PaymentMethod.CARD_STRIPE,
        gateway: PaymentGateway.STRIPE,
        gatewayTransactionId: 'pi_1234567890',
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaClient.payment.update.mockResolvedValue(mockUpdatedPayment);

      const result = await repository.update('payment-123', updatedData);

      expect(result).toBeInstanceOf(Payment);
      expect(result.status).toBe(PaymentStatus.SUCCEEDED);
      expect(mockPrismaClient.payment.update).toHaveBeenCalledWith({
        where: { id: 'payment-123' },
        data: updatedData,
      });
    });
  });

  describe('delete', () => {
    it('should delete a payment', async () => {
      mockPrismaClient.payment.delete.mockResolvedValue({});

      await repository.delete('payment-123');

      expect(mockPrismaClient.payment.delete).toHaveBeenCalledWith({
        where: { id: 'payment-123' },
      });
    });
  });
});

