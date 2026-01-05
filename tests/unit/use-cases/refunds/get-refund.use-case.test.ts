import { GetRefundUseCase } from '../../../../src/core/application/use-cases/refunds/get-refund.use-case';
import { IRefundRepository } from '../../../../src/core/domain/interfaces/refund-repository.interface';
import { Refund } from '../../../../src/core/domain/entities/refund.entity';
import { RefundStatus } from '@prisma/client';
import { AppError } from '../../../../src/shared/errors';

describe('GetRefundUseCase', () => {
  let getRefundUseCase: GetRefundUseCase;
  let mockRefundRepository: jest.Mocked<IRefundRepository>;

  beforeEach(() => {
    mockRefundRepository = {
      findById: jest.fn(),
      findByPaymentId: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as any;

    getRefundUseCase = new GetRefundUseCase(mockRefundRepository);
  });

  it('should get a refund successfully', async () => {
    const refundId = 'refund-123';
    const input = {
      refund_id: refundId,
    };

    const refund = new Refund(
      refundId,
      'payment-123',
      50.00,
      'Customer requested refund',
      null,
      RefundStatus.SUCCEEDED,
      new Date()
    );

    mockRefundRepository.findById.mockResolvedValue(refund);

    const result = await getRefundUseCase.execute(input);

    expect(result.id).toBe(refundId);
    expect(result.amount).toBe(50.00);
    expect(result.status).toBe(RefundStatus.SUCCEEDED);
    expect(mockRefundRepository.findById).toHaveBeenCalledWith(refundId);
  });

  it('should throw error if refund not found', async () => {
    const input = {
      refund_id: 'non-existent',
    };

    mockRefundRepository.findById.mockResolvedValue(null);

    await expect(getRefundUseCase.execute(input)).rejects.toThrow(AppError);
    try {
      await getRefundUseCase.execute(input);
    } catch (error: any) {
      expect(error.code).toBe('REFUND_NOT_FOUND');
    }
  });
});

