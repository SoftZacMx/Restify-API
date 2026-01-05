import { ListRefundsUseCase } from '../../../../src/core/application/use-cases/refunds/list-refunds.use-case';
import { IRefundRepository } from '../../../../src/core/domain/interfaces/refund-repository.interface';
import { Refund } from '../../../../src/core/domain/entities/refund.entity';
import { RefundStatus } from '@prisma/client';

describe('ListRefundsUseCase', () => {
  let listRefundsUseCase: ListRefundsUseCase;
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

    listRefundsUseCase = new ListRefundsUseCase(mockRefundRepository);
  });

  it('should list all refunds when no filters provided', async () => {
    const refunds = [
      new Refund(
        'refund-1',
        'payment-1',
        50.00,
        null,
        null,
        RefundStatus.SUCCEEDED,
        new Date()
      ),
      new Refund(
        'refund-2',
        'payment-2',
        30.00,
        'Reason',
        null,
        RefundStatus.PENDING,
        new Date()
      ),
    ];

    mockRefundRepository.findAll.mockResolvedValue(refunds);

    const result = await listRefundsUseCase.execute();

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('refund-1');
    expect(result[1].id).toBe('refund-2');
    expect(mockRefundRepository.findAll).toHaveBeenCalledWith(undefined);
  });

  it('should filter refunds by paymentId', async () => {
    const paymentId = 'payment-123';
    const input = {
      paymentId,
    };

    const refunds = [
      new Refund(
        'refund-1',
        paymentId,
        50.00,
        null,
        null,
        RefundStatus.SUCCEEDED,
        new Date()
      ),
    ];

    mockRefundRepository.findAll.mockResolvedValue(refunds);

    const result = await listRefundsUseCase.execute(input);

    expect(result).toHaveLength(1);
    expect(result[0].paymentId).toBe(paymentId);
    expect(mockRefundRepository.findAll).toHaveBeenCalledWith({
      paymentId,
      status: undefined,
      dateFrom: undefined,
      dateTo: undefined,
    });
  });

  it('should filter refunds by status', async () => {
    const input = {
      status: RefundStatus.SUCCEEDED,
    };

    const refunds = [
      new Refund(
        'refund-1',
        'payment-1',
        50.00,
        null,
        null,
        RefundStatus.SUCCEEDED,
        new Date()
      ),
    ];

    mockRefundRepository.findAll.mockResolvedValue(refunds);

    const result = await listRefundsUseCase.execute(input);

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe(RefundStatus.SUCCEEDED);
  });

  it('should filter refunds by date range', async () => {
    const dateFrom = '2024-01-01T00:00:00Z';
    const dateTo = '2024-01-31T23:59:59Z';
    const input = {
      dateFrom,
      dateTo,
    };

    const refunds: Refund[] = [];

    mockRefundRepository.findAll.mockResolvedValue(refunds);

    await listRefundsUseCase.execute(input);

    expect(mockRefundRepository.findAll).toHaveBeenCalledWith({
      paymentId: undefined,
      status: undefined,
      dateFrom: new Date(dateFrom),
      dateTo: new Date(dateTo),
    });
  });
});

