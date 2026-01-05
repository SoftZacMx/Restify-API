import { RefundRepository } from '../../../src/core/infrastructure/database/repositories/refund.repository';
import { RefundStatus } from '@prisma/client';
import { Refund } from '../../../src/core/domain/entities/refund.entity';

describe('RefundRepository', () => {
  let refundRepository: RefundRepository;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      refund: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    refundRepository = new RefundRepository(mockPrisma);
  });

  describe('findById', () => {
    it('should find a refund by id', async () => {
      const refundId = 'refund-123';
      const mockRefund = {
        id: refundId,
        paymentId: 'payment-123',
        amount: 50.00,
        reason: 'Customer requested',
        gatewayRefundId: null,
        status: RefundStatus.SUCCEEDED,
        createdAt: new Date(),
      };

      mockPrisma.refund.findUnique.mockResolvedValue(mockRefund as any);

      const result = await refundRepository.findById(refundId);

      expect(result).toBeInstanceOf(Refund);
      expect(result?.id).toBe(refundId);
      expect(result?.amount).toBe(50.00);
      expect(mockPrisma.refund.findUnique).toHaveBeenCalledWith({
        where: { id: refundId },
      });
    });

    it('should return null if refund not found', async () => {
      mockPrisma.refund.findUnique.mockResolvedValue(null);

      const result = await refundRepository.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findByPaymentId', () => {
    it('should find refunds by payment id', async () => {
      const paymentId = 'payment-123';
      const mockRefunds = [
        {
          id: 'refund-1',
          paymentId,
          amount: 50.00,
          reason: null,
          gatewayRefundId: null,
          status: RefundStatus.SUCCEEDED,
          createdAt: new Date(),
        },
        {
          id: 'refund-2',
          paymentId,
          amount: 30.00,
          reason: 'Partial refund',
          gatewayRefundId: null,
          status: RefundStatus.PENDING,
          createdAt: new Date(),
        },
      ];

      mockPrisma.refund.findMany.mockResolvedValue(mockRefunds as any);

      const result = await refundRepository.findByPaymentId(paymentId);

      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(Refund);
      expect(result[0].paymentId).toBe(paymentId);
      expect(mockPrisma.refund.findMany).toHaveBeenCalledWith({
        where: { paymentId },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('findAll', () => {
    it('should find all refunds without filters', async () => {
      const mockRefunds = [
        {
          id: 'refund-1',
          paymentId: 'payment-1',
          amount: 50.00,
          reason: null,
          gatewayRefundId: null,
          status: RefundStatus.SUCCEEDED,
          createdAt: new Date(),
        },
      ];

      mockPrisma.refund.findMany.mockResolvedValue(mockRefunds as any);

      const result = await refundRepository.findAll();

      expect(result).toHaveLength(1);
      expect(mockPrisma.refund.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter refunds by paymentId', async () => {
      const paymentId = 'payment-123';
      const filters = { paymentId };

      mockPrisma.refund.findMany.mockResolvedValue([]);

      await refundRepository.findAll(filters);

      expect(mockPrisma.refund.findMany).toHaveBeenCalledWith({
        where: { paymentId },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter refunds by status', async () => {
      const filters = { status: RefundStatus.SUCCEEDED };

      mockPrisma.refund.findMany.mockResolvedValue([]);

      await refundRepository.findAll(filters);

      expect(mockPrisma.refund.findMany).toHaveBeenCalledWith({
        where: { status: RefundStatus.SUCCEEDED },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter refunds by date range', async () => {
      const dateFrom = new Date('2024-01-01');
      const dateTo = new Date('2024-01-31');
      const filters = { dateFrom, dateTo };

      mockPrisma.refund.findMany.mockResolvedValue([]);

      await refundRepository.findAll(filters);

      expect(mockPrisma.refund.findMany).toHaveBeenCalledWith({
        where: {
          createdAt: {
            gte: dateFrom,
            lte: dateTo,
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('create', () => {
    it('should create a refund', async () => {
      const refundData = {
        paymentId: 'payment-123',
        amount: 50.00,
        reason: 'Customer requested',
        gatewayRefundId: null,
        status: RefundStatus.SUCCEEDED,
      };

      const mockCreatedRefund = {
        id: 'refund-123',
        ...refundData,
        createdAt: new Date(),
      };

      mockPrisma.refund.create.mockResolvedValue(mockCreatedRefund as any);

      const result = await refundRepository.create(refundData);

      expect(result).toBeInstanceOf(Refund);
      expect(result.amount).toBe(50.00);
      expect(mockPrisma.refund.create).toHaveBeenCalledWith({
        data: {
          paymentId: refundData.paymentId,
          amount: refundData.amount,
          reason: refundData.reason || null,
          gatewayRefundId: refundData.gatewayRefundId || null,
          status: refundData.status,
        },
      });
    });
  });

  describe('update', () => {
    it('should update a refund', async () => {
      const refundId = 'refund-123';
      const updateData = {
        status: RefundStatus.SUCCEEDED,
        gatewayRefundId: 're_stripe_123',
      };

      const mockUpdatedRefund = {
        id: refundId,
        paymentId: 'payment-123',
        amount: 50.00,
        reason: null,
        gatewayRefundId: 're_stripe_123',
        status: RefundStatus.SUCCEEDED,
        createdAt: new Date(),
      };

      mockPrisma.refund.update.mockResolvedValue(mockUpdatedRefund as any);

      const result = await refundRepository.update(refundId, updateData);

      expect(result).toBeInstanceOf(Refund);
      expect(result.status).toBe(RefundStatus.SUCCEEDED);
      expect(result.gatewayRefundId).toBe('re_stripe_123');
      expect(mockPrisma.refund.update).toHaveBeenCalledWith({
        where: { id: refundId },
        data: updateData,
      });
    });

    it('should update only provided fields', async () => {
      const refundId = 'refund-123';
      const updateData = {
        status: RefundStatus.FAILED,
      };

      const mockUpdatedRefund = {
        id: refundId,
        paymentId: 'payment-123',
        amount: 50.00,
        reason: null,
        gatewayRefundId: null,
        status: RefundStatus.FAILED,
        createdAt: new Date(),
      };

      mockPrisma.refund.update.mockResolvedValue(mockUpdatedRefund as any);

      const result = await refundRepository.update(refundId, updateData);

      expect(result.status).toBe(RefundStatus.FAILED);
    });
  });

  describe('delete', () => {
    it('should delete a refund', async () => {
      const refundId = 'refund-123';

      mockPrisma.refund.delete.mockResolvedValue({} as any);

      await refundRepository.delete(refundId);

      expect(mockPrisma.refund.delete).toHaveBeenCalledWith({
        where: { id: refundId },
      });
    });
  });
});

