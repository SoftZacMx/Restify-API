import { CreateRefundUseCase } from '../../../../src/core/application/use-cases/refunds/create-refund.use-case';
import { IPaymentRepository } from '../../../../src/core/domain/interfaces/payment-repository.interface';
import { IRefundRepository } from '../../../../src/core/domain/interfaces/refund-repository.interface';
import { Payment } from '../../../../src/core/domain/entities/payment.entity';
import { Refund } from '../../../../src/core/domain/entities/refund.entity';
import { PaymentStatus, PaymentMethod, PaymentGateway, RefundStatus } from '@prisma/client';
import { AppError } from '../../../../src/shared/errors';

describe('CreateRefundUseCase', () => {
  let createRefundUseCase: CreateRefundUseCase;
  let mockPaymentRepository: jest.Mocked<IPaymentRepository>;
  let mockRefundRepository: jest.Mocked<IRefundRepository>;

  beforeEach(() => {
    mockPaymentRepository = {
      findById: jest.fn(),
      findByOrderId: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as any;

    mockRefundRepository = {
      findById: jest.fn(),
      findByPaymentId: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as any;

    createRefundUseCase = new CreateRefundUseCase(
      mockPaymentRepository,
      mockRefundRepository
    );
  });

  it('should create a refund for a cash payment successfully', async () => {
    const paymentId = 'payment-123';
    const orderId = 'order-123';
    const input = {
      paymentId,
      amount: 50.00,
      reason: 'Customer requested refund',
    };

    const payment = new Payment(
      paymentId,
      orderId,
      'user-123',
      100.00,
      'USD',
      PaymentStatus.SUCCEEDED,
      PaymentMethod.CASH,
      null, // gateway
      null, // gatewayTransactionId
      null, // metadata
      new Date(),
      new Date()
    );

    const refund = new Refund(
      'refund-123',
      paymentId,
      50.00,
      'Customer requested refund',
      null, // gatewayRefundId
      RefundStatus.SUCCEEDED,
      new Date()
    );

    mockPaymentRepository.findById.mockResolvedValue(payment);
    mockRefundRepository.findByPaymentId.mockResolvedValue([]);
    mockRefundRepository.create.mockResolvedValue(refund);
    mockPaymentRepository.update.mockResolvedValue(
      new Payment(
        paymentId,
        orderId,
        'user-123',
        100.00,
        'USD',
        PaymentStatus.PARTIALLY_REFUNDED,
        PaymentMethod.CASH,
        null,
        null,
        null,
        new Date(),
        new Date()
      )
    );
    mockPaymentRepository.findById.mockResolvedValueOnce(payment).mockResolvedValueOnce(
      new Payment(
        paymentId,
        orderId,
        'user-123',
        100.00,
        'USD',
        PaymentStatus.PARTIALLY_REFUNDED,
        PaymentMethod.CASH,
        null,
        null,
        null,
        new Date(),
        new Date()
      )
    );

    const result = await createRefundUseCase.execute(input);

    expect(result.refund.id).toBe('refund-123');
    expect(result.refund.amount).toBe(50.00);
    expect(result.refund.status).toBe(RefundStatus.SUCCEEDED);
    expect(result.payment.status).toBe(PaymentStatus.PARTIALLY_REFUNDED);
    expect(mockRefundRepository.create).toHaveBeenCalledWith({
      paymentId,
      amount: 50.00,
      reason: 'Customer requested refund',
      gatewayRefundId: null,
      status: RefundStatus.SUCCEEDED,
    });
  });

  it('should create a full refund and update payment to REFUNDED', async () => {
    const paymentId = 'payment-123';
    const orderId = 'order-123';
    const input = {
      paymentId,
      amount: 100.00,
    };

    const payment = new Payment(
      paymentId,
      orderId,
      'user-123',
      100.00,
      'USD',
      PaymentStatus.SUCCEEDED,
      PaymentMethod.CASH,
      null,
      null,
      null,
      new Date(),
      new Date()
    );

    const refund = new Refund(
      'refund-123',
      paymentId,
      100.00,
      null,
      null,
      RefundStatus.SUCCEEDED,
      new Date()
    );

    mockPaymentRepository.findById.mockResolvedValue(payment);
    mockRefundRepository.findByPaymentId.mockResolvedValue([]);
    mockRefundRepository.create.mockResolvedValue(refund);
    mockPaymentRepository.update.mockResolvedValue(
      new Payment(
        paymentId,
        orderId,
        'user-123',
        100.00,
        'USD',
        PaymentStatus.REFUNDED,
        PaymentMethod.CASH,
        null,
        null,
        null,
        new Date(),
        new Date()
      )
    );
    mockPaymentRepository.findById.mockResolvedValueOnce(payment).mockResolvedValueOnce(
      new Payment(
        paymentId,
        orderId,
        'user-123',
        100.00,
        'USD',
        PaymentStatus.REFUNDED,
        PaymentMethod.CASH,
        null,
        null,
        null,
        new Date(),
        new Date()
      )
    );

    const result = await createRefundUseCase.execute(input);

    expect(result.refund.amount).toBe(100.00);
    expect(result.payment.status).toBe(PaymentStatus.REFUNDED);
    expect(mockPaymentRepository.update).toHaveBeenCalledWith(paymentId, {
      status: PaymentStatus.REFUNDED,
    });
  });

  it('should throw error if payment not found', async () => {
    const input = {
      paymentId: 'non-existent',
      amount: 50.00,
    };

    mockPaymentRepository.findById.mockResolvedValue(null);

    await expect(createRefundUseCase.execute(input)).rejects.toThrow(AppError);
    try {
      await createRefundUseCase.execute(input);
    } catch (error: any) {
      expect(error.code).toBe('PAYMENT_NOT_FOUND');
    }
  });

  it('should throw error if payment is not SUCCEEDED', async () => {
    const paymentId = 'payment-123';
    const orderId = 'order-123';
    const input = {
      paymentId,
      amount: 50.00,
    };

    const payment = new Payment(
      paymentId,
      orderId,
      'user-123',
      100.00,
      'USD',
      PaymentStatus.PENDING,
      PaymentMethod.CASH,
      null,
      null,
      null,
      new Date(),
      new Date()
    );

    mockPaymentRepository.findById.mockResolvedValue(payment);

    await expect(createRefundUseCase.execute(input)).rejects.toThrow(AppError);
    try {
      await createRefundUseCase.execute(input);
    } catch (error: any) {
      expect(error.code).toBe('PAYMENT_NOT_REFUNDABLE');
    }
  });

  it('should throw error if refund amount exceeds remaining amount', async () => {
    const paymentId = 'payment-123';
    const orderId = 'order-123';
    const input = {
      paymentId,
      amount: 150.00, // More than payment amount
    };

    const payment = new Payment(
      paymentId,
      orderId,
      'user-123',
      100.00,
      'USD',
      PaymentStatus.SUCCEEDED,
      PaymentMethod.CASH,
      null,
      null,
      null,
      new Date(),
      new Date()
    );

    mockPaymentRepository.findById.mockResolvedValue(payment);
    mockRefundRepository.findByPaymentId.mockResolvedValue([]);

    await expect(createRefundUseCase.execute(input)).rejects.toThrow(AppError);
    try {
      await createRefundUseCase.execute(input);
    } catch (error: any) {
      expect(error.code).toBe('REFUND_AMOUNT_EXCEEDS_REMAINING');
    }
  });

  it('should throw error if refund amount exceeds remaining after partial refund', async () => {
    const paymentId = 'payment-123';
    const orderId = 'order-123';
    const input = {
      paymentId,
      amount: 60.00, // Would exceed remaining (100 - 50 = 50)
    };

    const payment = new Payment(
      paymentId,
      orderId,
      'user-123',
      100.00,
      'USD',
      PaymentStatus.SUCCEEDED,
      PaymentMethod.CASH,
      null,
      null,
      null,
      new Date(),
      new Date()
    );

    const existingRefund = new Refund(
      'refund-1',
      paymentId,
      50.00,
      null,
      null,
      RefundStatus.SUCCEEDED,
      new Date()
    );

    mockPaymentRepository.findById.mockResolvedValue(payment);
    mockRefundRepository.findByPaymentId.mockResolvedValue([existingRefund]);

    await expect(createRefundUseCase.execute(input)).rejects.toThrow(AppError);
    try {
      await createRefundUseCase.execute(input);
    } catch (error: any) {
      expect(error.code).toBe('REFUND_AMOUNT_EXCEEDS_REMAINING');
    }
  });

  it('should create refund with PENDING status for Stripe payments', async () => {
    const paymentId = 'payment-123';
    const orderId = 'order-123';
    const input = {
      paymentId,
      amount: 50.00,
    };

    const payment = new Payment(
      paymentId,
      orderId,
      'user-123',
      100.00,
      'USD',
      PaymentStatus.SUCCEEDED,
      PaymentMethod.CARD_STRIPE,
      PaymentGateway.STRIPE,
      'pi_stripe_123',
      null,
      new Date(),
      new Date()
    );

    const refund = new Refund(
      'refund-123',
      paymentId,
      50.00,
      null,
      null,
      RefundStatus.PENDING,
      new Date()
    );

    mockPaymentRepository.findById.mockResolvedValue(payment);
    mockRefundRepository.findByPaymentId.mockResolvedValue([]);
    mockRefundRepository.create.mockResolvedValue(refund);
    mockPaymentRepository.update.mockResolvedValue(payment);
    mockPaymentRepository.findById.mockResolvedValueOnce(payment).mockResolvedValueOnce(
      new Payment(
        paymentId,
        orderId,
        'user-123',
        100.00,
        'USD',
        PaymentStatus.PARTIALLY_REFUNDED,
        PaymentMethod.CARD_STRIPE,
        PaymentGateway.STRIPE,
        'pi_stripe_123',
        null,
        new Date(),
        new Date()
      )
    );

    const result = await createRefundUseCase.execute(input);

    expect(result.refund.status).toBe(RefundStatus.PENDING);
    expect(mockRefundRepository.create).toHaveBeenCalledWith({
      paymentId,
      amount: 50.00,
      reason: null,
      gatewayRefundId: null,
      status: RefundStatus.PENDING,
    });
  });

  it('should throw error if refund amount is zero or negative', async () => {
    const paymentId = 'payment-123';
    const orderId = 'order-123';
    const input = {
      paymentId,
      amount: -10.00,
    };

    const payment = new Payment(
      paymentId,
      orderId,
      'user-123',
      100.00,
      'USD',
      PaymentStatus.SUCCEEDED,
      PaymentMethod.CASH,
      null,
      null,
      null,
      new Date(),
      new Date()
    );

    mockPaymentRepository.findById.mockResolvedValue(payment);
    mockRefundRepository.findByPaymentId.mockResolvedValue([]);

    await expect(createRefundUseCase.execute(input)).rejects.toThrow(AppError);
    try {
      await createRefundUseCase.execute(input);
    } catch (error: any) {
      expect(error.code).toBe('INVALID_AMOUNT');
    }
  });
});

