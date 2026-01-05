import { ProcessStripeRefundUseCase } from '../../../../src/core/application/use-cases/refunds/process-stripe-refund.use-case';
import { IRefundRepository } from '../../../../src/core/domain/interfaces/refund-repository.interface';
import { IPaymentRepository } from '../../../../src/core/domain/interfaces/payment-repository.interface';
import { Refund } from '../../../../src/core/domain/entities/refund.entity';
import { Payment } from '../../../../src/core/domain/entities/payment.entity';
import { RefundStatus, PaymentStatus, PaymentMethod, PaymentGateway } from '@prisma/client';
import { AppError } from '../../../../src/shared/errors';
import { StripeService } from '../../../../src/core/infrastructure/payment-gateways/stripe.service';

describe('ProcessStripeRefundUseCase', () => {
  let processStripeRefundUseCase: ProcessStripeRefundUseCase;
  let mockRefundRepository: jest.Mocked<IRefundRepository>;
  let mockPaymentRepository: jest.Mocked<IPaymentRepository>;
  let mockStripeService: jest.Mocked<StripeService>;

  beforeEach(() => {
    mockRefundRepository = {
      findById: jest.fn(),
      findByPaymentId: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as any;

    mockPaymentRepository = {
      findById: jest.fn(),
      findByOrderId: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as any;

    mockStripeService = {
      retrieveRefund: jest.fn(),
    } as any;

    processStripeRefundUseCase = new ProcessStripeRefundUseCase(
      mockRefundRepository,
      mockPaymentRepository,
      mockStripeService
    );
  });

  it('should process a successful Stripe refund', async () => {
    const refundId = 'refund-123';
    const paymentId = 'payment-123';
    const orderId = 'order-123';
    const input = {
      refundId,
      stripeRefundId: 're_stripe_123',
      status: 'succeeded' as const,
    };

    const refund = new Refund(
      refundId,
      paymentId,
      50.00,
      null,
      null,
      RefundStatus.PENDING,
      new Date()
    );

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

    const stripeRefund = {
      id: 're_stripe_123',
      status: 'succeeded',
    } as any;

    const updatedRefund = new Refund(
      refundId,
      paymentId,
      50.00,
      null,
      're_stripe_123',
      RefundStatus.SUCCEEDED,
      new Date()
    );

    const updatedPayment = new Payment(
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
    );

    mockRefundRepository.findById.mockResolvedValue(refund);
    mockStripeService.retrieveRefund.mockResolvedValue(stripeRefund);
    mockRefundRepository.update.mockResolvedValue(updatedRefund);
    mockPaymentRepository.findById.mockResolvedValue(payment);
    mockRefundRepository.findByPaymentId.mockResolvedValue([updatedRefund]);
    mockPaymentRepository.update.mockResolvedValue(updatedPayment);
    mockPaymentRepository.findById.mockResolvedValueOnce(payment).mockResolvedValueOnce(updatedPayment);

    const result = await processStripeRefundUseCase.execute(input);

    expect(result.refund.status).toBe(RefundStatus.SUCCEEDED);
    expect(result.refund.gatewayRefundId).toBe('re_stripe_123');
    expect(result.payment.status).toBe(PaymentStatus.PARTIALLY_REFUNDED);
    expect(mockRefundRepository.update).toHaveBeenCalledWith(refundId, {
      status: RefundStatus.SUCCEEDED,
      gatewayRefundId: 're_stripe_123',
    });
  });

  it('should process a failed Stripe refund', async () => {
    const refundId = 'refund-123';
    const paymentId = 'payment-123';
    const orderId = 'order-123';
    const input = {
      refundId,
      stripeRefundId: 're_stripe_123',
      status: 'failed' as const,
    };

    const refund = new Refund(
      refundId,
      paymentId,
      50.00,
      null,
      null,
      RefundStatus.PENDING,
      new Date()
    );

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

    const stripeRefund = {
      id: 're_stripe_123',
      status: 'failed',
    } as any;

    const updatedRefund = new Refund(
      refundId,
      paymentId,
      50.00,
      null,
      're_stripe_123',
      RefundStatus.FAILED,
      new Date()
    );

    mockRefundRepository.findById.mockResolvedValue(refund);
    mockStripeService.retrieveRefund.mockResolvedValue(stripeRefund);
    mockRefundRepository.update.mockResolvedValue(updatedRefund);
    mockPaymentRepository.findById.mockResolvedValue(payment);
    mockPaymentRepository.findById.mockResolvedValueOnce(payment).mockResolvedValueOnce(payment);

    const result = await processStripeRefundUseCase.execute(input);

    expect(result.refund.status).toBe(RefundStatus.FAILED);
    expect(mockRefundRepository.update).toHaveBeenCalledWith(refundId, {
      status: RefundStatus.FAILED,
      gatewayRefundId: 're_stripe_123',
    });
  });

  it('should throw error if refund not found', async () => {
    const input = {
      refundId: 'non-existent',
      stripeRefundId: 're_stripe_123',
      status: 'succeeded' as const,
    };

    mockRefundRepository.findById.mockResolvedValue(null);

    await expect(processStripeRefundUseCase.execute(input)).rejects.toThrow(AppError);
    try {
      await processStripeRefundUseCase.execute(input);
    } catch (error: any) {
      expect(error.code).toBe('REFUND_NOT_FOUND');
    }
  });

  it('should throw error if status mismatch', async () => {
    const refundId = 'refund-123';
    const paymentId = 'payment-123';
    const input = {
      refundId,
      stripeRefundId: 're_stripe_123',
      status: 'succeeded' as const,
    };

    const refund = new Refund(
      refundId,
      paymentId,
      50.00,
      null,
      null,
      RefundStatus.PENDING,
      new Date()
    );

    const stripeRefund = {
      id: 're_stripe_123',
      status: 'failed', // Mismatch
    } as any;

    mockRefundRepository.findById.mockResolvedValue(refund);
    mockStripeService.retrieveRefund.mockResolvedValue(stripeRefund);

    await expect(processStripeRefundUseCase.execute(input)).rejects.toThrow(AppError);
    try {
      await processStripeRefundUseCase.execute(input);
    } catch (error: any) {
      expect(error.code).toBe('REFUND_STATUS_MISMATCH');
    }
  });

  it('should update payment to REFUNDED when fully refunded', async () => {
    const refundId = 'refund-123';
    const paymentId = 'payment-123';
    const orderId = 'order-123';
    const input = {
      refundId,
      stripeRefundId: 're_stripe_123',
      status: 'succeeded' as const,
    };

    const refund = new Refund(
      refundId,
      paymentId,
      100.00,
      null,
      null,
      RefundStatus.PENDING,
      new Date()
    );

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

    const stripeRefund = {
      id: 're_stripe_123',
      status: 'succeeded',
    } as any;

    const updatedRefund = new Refund(
      refundId,
      paymentId,
      100.00,
      null,
      're_stripe_123',
      RefundStatus.SUCCEEDED,
      new Date()
    );

    const updatedPayment = new Payment(
      paymentId,
      orderId,
      'user-123',
      100.00,
      'USD',
      PaymentStatus.REFUNDED,
      PaymentMethod.CARD_STRIPE,
      PaymentGateway.STRIPE,
      'pi_stripe_123',
      null,
      new Date(),
      new Date()
    );

    mockRefundRepository.findById.mockResolvedValue(refund);
    mockStripeService.retrieveRefund.mockResolvedValue(stripeRefund);
    mockRefundRepository.update.mockResolvedValue(updatedRefund);
    mockPaymentRepository.findById.mockResolvedValue(payment);
    mockRefundRepository.findByPaymentId.mockResolvedValue([updatedRefund]);
    mockPaymentRepository.update.mockResolvedValue(updatedPayment);
    mockPaymentRepository.findById.mockResolvedValueOnce(payment).mockResolvedValueOnce(updatedPayment);

    const result = await processStripeRefundUseCase.execute(input);

    expect(result.payment.status).toBe(PaymentStatus.REFUNDED);
    expect(mockPaymentRepository.update).toHaveBeenCalledWith(paymentId, {
      status: PaymentStatus.REFUNDED,
    });
  });
});

