import { PayOrderWithQRMercadoPagoUseCase } from '../../../../src/core/application/use-cases/payments/pay-order-with-qr-mercado-pago.use-case';
import { IOrderRepository } from '../../../../src/core/domain/interfaces/order-repository.interface';
import { IPaymentRepository } from '../../../../src/core/domain/interfaces/payment-repository.interface';
import { IPaymentSessionRepository } from '../../../../src/core/domain/interfaces/payment-session-repository.interface';
import { MercadoPagoService } from '../../../../src/core/infrastructure/payment-gateways/mercado-pago.service';
import { Order } from '../../../../src/core/domain/entities/order.entity';
import { Payment } from '../../../../src/core/domain/entities/payment.entity';
import { PaymentSession } from '../../../../src/core/domain/entities/payment-session.entity';
import { PaymentStatus, PaymentMethod, PaymentGateway } from '@prisma/client';
import { AppError } from '../../../../src/shared/errors';

describe('PayOrderWithQRMercadoPagoUseCase', () => {
  let useCase: PayOrderWithQRMercadoPagoUseCase;
  let mockOrderRepository: jest.Mocked<IOrderRepository>;
  let mockPaymentRepository: jest.Mocked<IPaymentRepository>;
  let mockPaymentSessionRepository: jest.Mocked<IPaymentSessionRepository>;
  let mockMercadoPagoService: jest.Mocked<MercadoPagoService>;

  const orderId = 'order-123';
  const userId = 'user-123';
  const paymentId = 'payment-123';

  const mockOrder = new Order(
    orderId,
    new Date(),
    false,
    null,
    150.50,
    129.74,
    20.76,
    false,
    'table-1',
    0,
    'Local',
    null,
    false,
    null,
    userId,
    null, null, null, null, null, null, null, null,
    new Date(),
    new Date()
  );

  beforeEach(() => {
    mockOrderRepository = {
      findById: jest.fn(),
      findByTrackingToken: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      createOrderItem: jest.fn(),
      findOrderItemsByOrderId: jest.fn(),
      updateOrderItem: jest.fn(),
      deleteOrderItem: jest.fn(),
      deleteOrderItemsByOrderId: jest.fn(),
      createOrderItemExtra: jest.fn(),
      deleteOrderItemExtrasByOrderId: jest.fn(),
      deleteOrderItemExtrasByOrderItemId: jest.fn(),
      findOrderItemExtrasByOrderId: jest.fn(),
      findOrderItemExtrasByOrderItemId: jest.fn(),
      count: jest.fn(),
    };

    mockPaymentRepository = {
      findById: jest.fn(),
      findByGatewayTransactionId: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    mockPaymentSessionRepository = {
      findById: jest.fn(),
      findByPaymentId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteByPaymentId: jest.fn(),
    };

    mockMercadoPagoService = {
      createPreference: jest.fn(),
      getPreference: jest.fn(),
      getPayment: jest.fn(),
      validateWebhookSignature: jest.fn(),
    } as any;

    process.env.MP_NOTIFICATION_URL = 'https://api.restify.com/webhooks/mercado-pago';

    useCase = new PayOrderWithQRMercadoPagoUseCase(
      mockOrderRepository,
      mockPaymentRepository,
      mockPaymentSessionRepository,
      mockMercadoPagoService
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.MP_NOTIFICATION_URL;
  });

  it('should generate QR payment successfully', async () => {
    const mockPayment = new Payment(
      paymentId, orderId, userId, 150.50, 'MXN',
      PaymentStatus.PENDING, PaymentMethod.QR_MERCADO_PAGO,
      PaymentGateway.MERCADO_PAGO, null, null, new Date(), new Date()
    );

    const updatedPayment = new Payment(
      paymentId, orderId, userId, 150.50, 'MXN',
      PaymentStatus.PENDING, PaymentMethod.QR_MERCADO_PAGO,
      PaymentGateway.MERCADO_PAGO, 'pref-abc', null, new Date(), new Date()
    );

    const mockSession = new PaymentSession(
      'session-1', paymentId, 'https://mp.com/checkout', null, new Date(), new Date()
    );

    mockOrderRepository.findById.mockResolvedValue(mockOrder);
    mockPaymentRepository.findAll.mockResolvedValue([]);
    mockPaymentRepository.create.mockResolvedValue(mockPayment);
    mockMercadoPagoService.createPreference.mockResolvedValue({
      id: 'pref-abc',
      initPoint: 'https://mp.com/checkout',
      sandboxInitPoint: 'https://sandbox.mp.com/checkout',
      expirationDate: '2026-03-27T12:30:00.000Z',
    });
    mockPaymentRepository.update.mockResolvedValue(updatedPayment);
    mockPaymentSessionRepository.create.mockResolvedValue(mockSession);

    const result = await useCase.execute({ orderId, userId });

    expect(result.paymentId).toBe(paymentId);
    expect(result.preferenceId).toBe('pref-abc');
    expect(result.initPoint).toBe('https://mp.com/checkout');
    expect(result.expiresAt).toBeInstanceOf(Date);

    expect(mockPaymentRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      orderId,
      userId,
      amount: 150.50,
      currency: 'MXN',
      status: PaymentStatus.PENDING,
      paymentMethod: PaymentMethod.QR_MERCADO_PAGO,
      gateway: PaymentGateway.MERCADO_PAGO,
    }));

    expect(mockMercadoPagoService.createPreference).toHaveBeenCalledWith(expect.objectContaining({
      orderId,
      amount: 150.50,
      currency: 'MXN',
    }));

    expect(mockPaymentRepository.update).toHaveBeenCalledWith(paymentId, {
      gatewayTransactionId: 'pref-abc',
    });

    expect(mockPaymentSessionRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      paymentId,
      clientSecret: 'https://mp.com/checkout',
    }));
  });

  it('should throw ORDER_NOT_FOUND when order does not exist', async () => {
    mockOrderRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute({ orderId, userId })).rejects.toThrow(AppError);
    await expect(useCase.execute({ orderId, userId })).rejects.toMatchObject({ code: 'ORDER_NOT_FOUND' });
  });

  it('should throw ORDER_ALREADY_PAID when order is already paid', async () => {
    const paidOrder = new Order(
      orderId, new Date(), true, 1, 150.50, 129.74, 20.76,
      false, null, 0, 'Local', null, false, null, userId, null, null, null, null, null, null, null, null, new Date(), new Date()
    );
    mockOrderRepository.findById.mockResolvedValue(paidOrder);

    await expect(useCase.execute({ orderId, userId })).rejects.toThrow(AppError);
    await expect(useCase.execute({ orderId, userId })).rejects.toMatchObject({ code: 'ORDER_ALREADY_PAID' });
  });

  it('should reuse existing preference when pending MP payment has a valid session', async () => {
    const pendingPayment = new Payment(
      'existing-pay', orderId, userId, 150.50, 'MXN',
      PaymentStatus.PENDING, PaymentMethod.QR_MERCADO_PAGO,
      PaymentGateway.MERCADO_PAGO, 'pref-old', null, new Date(), new Date()
    );

    const validSession = new PaymentSession(
      'session-old', 'existing-pay', 'https://mp.com/existing-checkout', null,
      new Date(Date.now() + 15 * 60 * 1000), // expires in 15 min (still valid)
      new Date()
    );

    mockOrderRepository.findById.mockResolvedValue(mockOrder);
    mockPaymentRepository.findAll.mockResolvedValue([pendingPayment]);
    mockPaymentSessionRepository.findByPaymentId.mockResolvedValue(validSession);

    const result = await useCase.execute({ orderId, userId });

    expect(result.paymentId).toBe('existing-pay');
    expect(result.preferenceId).toBe('pref-old');
    expect(result.initPoint).toBe('https://mp.com/existing-checkout');
    expect(result.expiresAt).toEqual(validSession.expiresAt);

    // Should NOT create a new payment or preference
    expect(mockPaymentRepository.create).not.toHaveBeenCalled();
    expect(mockMercadoPagoService.createPreference).not.toHaveBeenCalled();
  });

  it('should regenerate preference when existing session is expired', async () => {
    const pendingPayment = new Payment(
      'existing-pay', orderId, userId, 150.50, 'MXN',
      PaymentStatus.PENDING, PaymentMethod.QR_MERCADO_PAGO,
      PaymentGateway.MERCADO_PAGO, 'pref-old', null, new Date(), new Date()
    );

    const expiredSession = new PaymentSession(
      'session-old', 'existing-pay', 'https://mp.com/expired-checkout', null,
      new Date(Date.now() - 5 * 60 * 1000), // expired 5 min ago
      new Date()
    );

    const newPayment = new Payment(
      'new-pay', orderId, userId, 150.50, 'MXN',
      PaymentStatus.PENDING, PaymentMethod.QR_MERCADO_PAGO,
      PaymentGateway.MERCADO_PAGO, null, null, new Date(), new Date()
    );

    const updatedNewPayment = new Payment(
      'new-pay', orderId, userId, 150.50, 'MXN',
      PaymentStatus.PENDING, PaymentMethod.QR_MERCADO_PAGO,
      PaymentGateway.MERCADO_PAGO, 'pref-new', null, new Date(), new Date()
    );

    const newSession = new PaymentSession(
      'session-new', 'new-pay', 'https://mp.com/new-checkout', null,
      new Date(Date.now() + 30 * 60 * 1000),
      new Date()
    );

    mockOrderRepository.findById.mockResolvedValue(mockOrder);
    mockPaymentRepository.findAll.mockResolvedValue([pendingPayment]);
    mockPaymentSessionRepository.findByPaymentId.mockResolvedValue(expiredSession);
    mockPaymentSessionRepository.deleteByPaymentId.mockResolvedValue(undefined as any);
    mockPaymentRepository.update
      .mockResolvedValueOnce(pendingPayment) // cancel old payment
      .mockResolvedValueOnce(updatedNewPayment); // update new payment with preferenceId
    mockPaymentRepository.create.mockResolvedValue(newPayment);
    mockMercadoPagoService.createPreference.mockResolvedValue({
      id: 'pref-new',
      initPoint: 'https://mp.com/new-checkout',
      sandboxInitPoint: 'https://sandbox.mp.com/new-checkout',
      expirationDate: '2026-03-27T12:30:00.000Z',
    });
    mockPaymentSessionRepository.create.mockResolvedValue(newSession);

    const result = await useCase.execute({ orderId, userId });

    expect(result.paymentId).toBe('new-pay');
    expect(result.preferenceId).toBe('pref-new');
    expect(result.initPoint).toBe('https://mp.com/new-checkout');

    // Should have canceled old payment
    expect(mockPaymentRepository.update).toHaveBeenCalledWith('existing-pay', {
      status: PaymentStatus.CANCELED,
    });

    // Should have cleaned up expired session
    expect(mockPaymentSessionRepository.deleteByPaymentId).toHaveBeenCalledWith('existing-pay');

    // Should have created a new payment and preference
    expect(mockPaymentRepository.create).toHaveBeenCalled();
    expect(mockMercadoPagoService.createPreference).toHaveBeenCalled();
  });
});
