import { CreateStripeRefundUseCase } from '../../../../src/core/application/use-cases/refunds/create-stripe-refund.use-case';
import { IPaymentRepository } from '../../../../src/core/domain/interfaces/payment-repository.interface';
import { IRefundRepository } from '../../../../src/core/domain/interfaces/refund-repository.interface';
import { Payment } from '../../../../src/core/domain/entities/payment.entity';
import { Refund } from '../../../../src/core/domain/entities/refund.entity';
import { PaymentStatus, PaymentMethod, PaymentGateway, RefundStatus } from '@prisma/client';
import { AppError } from '../../../../src/shared/errors';
import { StripeService } from '../../../../src/core/infrastructure/payment-gateways/stripe.service';

describe('CreateStripeRefundUseCase', () => {
  let createStripeRefundUseCase: CreateStripeRefundUseCase;
  let mockPaymentRepository: jest.Mocked<IPaymentRepository>;
  let mockRefundRepository: jest.Mocked<IRefundRepository>;
  let mockStripeService: jest.Mocked<StripeService>;

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

    mockStripeService = {
      createRefund: jest.fn(),
      retrieveRefund: jest.fn(),
    } as any;

    createStripeRefundUseCase = new CreateStripeRefundUseCase(
      mockPaymentRepository,
      mockRefundRepository,
      mockStripeService
    );
  });

  it('should create a Stripe refund successfully', async () => {
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
      PaymentMethod.CARD_STRIPE,
      PaymentGateway.STRIPE,
      'pi_stripe_123',
      null,
      new Date(),
      new Date()
    );

    const stripeRefund = {
      id: 're_stripe_123',
      amount: 5000, // in cents
      status: 'pending',
    } as any;

    const refund = new Refund(
      'refund-123',
      paymentId,
      50.00,
      'Customer requested refund',
      're_stripe_123',
      RefundStatus.PENDING,
      new Date()
    );

    mockPaymentRepository.findById.mockResolvedValue(payment);
    mockRefundRepository.findByPaymentId.mockResolvedValue([]);
    mockStripeService.createRefund.mockResolvedValue(stripeRefund);
    mockRefundRepository.create.mockResolvedValue(refund);
    mockPaymentRepository.update.mockResolvedValue(
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

    const result = await createStripeRefundUseCase.execute(input);

    expect(result.refund.id).toBe('refund-123');
    expect(result.refund.amount).toBe(50.00);
    expect(result.refund.status).toBe(RefundStatus.PENDING);
    expect(result.refund.gatewayRefundId).toBe('re_stripe_123');
    expect(mockStripeService.createRefund).toHaveBeenCalledWith('pi_stripe_123', 50.00);
    expect(mockRefundRepository.create).toHaveBeenCalledWith({
      paymentId,
      amount: 50.00,
      reason: 'Customer requested refund',
      gatewayRefundId: 're_stripe_123',
      status: RefundStatus.PENDING,
    });
  });

  it('should throw error if payment is not via Stripe', async () => {
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
      PaymentMethod.CASH,
      null,
      null,
      null,
      new Date(),
      new Date()
    );

    mockPaymentRepository.findById.mockResolvedValue(payment);

    await expect(createStripeRefundUseCase.execute(input)).rejects.toThrow(AppError);
    try {
      await createStripeRefundUseCase.execute(input);
    } catch (error: any) {
      expect(error.code).toBe('PAYMENT_NOT_STRIPE');
    }
  });

  it('should throw error if Stripe refund creation fails', async () => {
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

    mockPaymentRepository.findById.mockResolvedValue(payment);
    mockRefundRepository.findByPaymentId.mockResolvedValue([]);
    mockStripeService.createRefund.mockRejectedValue(new Error('Stripe API error'));

    await expect(createStripeRefundUseCase.execute(input)).rejects.toThrow(AppError);
    try {
      await createStripeRefundUseCase.execute(input);
    } catch (error: any) {
      expect(error.code).toBe('STRIPE_REFUND_FAILED');
    }
  });
});

