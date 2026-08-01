import { PayOrderWithQRMercadoPagoUseCase, buildNotificationUrl } from '../../../../src/core/application/use-cases/payments/pay-order-with-qr-mercado-pago.use-case';
import { IPaymentRepository } from '../../../../src/core/domain/interfaces/payment-repository.interface';
import { IOrderRepository } from '../../../../src/core/domain/interfaces/order-repository.interface';
import { IPaymentSessionRepository } from '../../../../src/core/domain/interfaces/payment-session-repository.interface';
import { MercadoPagoService } from '../../../../src/core/infrastructure/payment-gateways/mercado-pago.service';
import { PaymentConfigService } from '../../../../src/core/application/services/payment-config.service';
import { Payment } from '../../../../src/core/domain/entities/payment.entity';
import { PaymentSession } from '../../../../src/core/domain/entities/payment-session.entity';
import { Order } from '../../../../src/core/domain/entities/order.entity';
import { PaymentStatus, PaymentMethod, PaymentGateway } from '@prisma/client';

describe('PayOrderWithQRMercadoPagoUseCase', () => {
  let useCase: PayOrderWithQRMercadoPagoUseCase;
  let mockOrderRepository: jest.Mocked<IOrderRepository>;
  let mockPaymentRepository: jest.Mocked<IPaymentRepository>;
  let mockPaymentSessionRepository: jest.Mocked<IPaymentSessionRepository>;
  let mockMercadoPagoService: jest.Mocked<MercadoPagoService>;
  let mockPaymentConfigService: jest.Mocked<PaymentConfigService>;

  const orderId = 'order-123';
  const userId = 'user-123';
  const paymentId = 'payment-123';
  const branchId = 'branch-456';
  const connectionId = 'conn-abc';

  const mockOrder = new Order(
    orderId, new Date(), false, null, 150.50, 129.74, 20.76,
    false, 'table-1', 0, 'Local', null, false, null, userId, null, null, null, null, null, null, null, null, branchId, new Date(), new Date()
  );

  const paidOrder = new Order(
    orderId, new Date(), true, 4, 150.50, 129.74, 20.76,
    false, 'table-1', 0, 'Local', null, false, null, userId, null, null, null, null, null, null, null, null, branchId, new Date(), new Date()
  );

  const createdPayment = new Payment(
    paymentId, orderId, userId, 150.50, 'MXN',
    PaymentStatus.PENDING, PaymentMethod.QR_MERCADO_PAGO,
    PaymentGateway.MERCADO_PAGO, null, null, new Date(), new Date()
  );

  const pendingMPPayment = new Payment(
    'payment-existing', orderId, userId, 150.50, 'MXN',
    PaymentStatus.PENDING, PaymentMethod.QR_MERCADO_PAGO,
    PaymentGateway.MERCADO_PAGO, 'pref-existing', null, new Date(), new Date()
  );

  const preferenceResult = {
    id: 'pref-abc',
    initPoint: 'https://www.mercadopago.com.mx/checkout/v1/redirect?pref_id=pref-abc',
    sandboxInitPoint: 'https://sandbox.mercadopago.com.mx/checkout/v1/redirect?pref_id=pref-abc',
    expirationDate: null,
  };

  beforeEach(() => {
    process.env.MP_NOTIFICATION_URL = 'https://api.restify.com/webhooks/mercado-pago';

    mockOrderRepository = {
      findById: jest.fn(),
      findByTrackingToken: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      createWithItems: jest.fn(),
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
      findAll: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue(createdPayment),
      update: jest.fn().mockImplementation(async (id: string, data: any) =>
        new Payment(id, orderId, userId, 150.50, 'MXN',
          data.status ?? PaymentStatus.PENDING, PaymentMethod.QR_MERCADO_PAGO,
          PaymentGateway.MERCADO_PAGO, data.gatewayTransactionId ?? null, null, new Date(), new Date())
      ),
      delete: jest.fn(),
    };

    mockPaymentSessionRepository = {
      findById: jest.fn(),
      findByPaymentId: jest.fn(),
      create: jest.fn().mockImplementation(async (data: any) =>
        new PaymentSession('session-1', data.paymentId, data.clientSecret, data.connectionId ?? null, data.expiresAt, new Date())
      ),
      update: jest.fn(),
      delete: jest.fn(),
      deleteByPaymentId: jest.fn(),
    };

    mockMercadoPagoService = {
      createPreference: jest.fn().mockResolvedValue(preferenceResult),
      getPreference: jest.fn(),
      getPayment: jest.fn(),
      cancelPayment: jest.fn(),
      validateWebhookSignature: jest.fn(),
    } as any;

    mockPaymentConfigService = {
      get: jest.fn(),
      getForCharging: jest.fn().mockResolvedValue({
        mercadoPago: { accessToken: 'TEST-token', webhookSecret: 'secret' },
      }),
      save: jest.fn(),
      clearCache: jest.fn(),
    } as any;

    useCase = new PayOrderWithQRMercadoPagoUseCase(
      mockOrderRepository,
      mockPaymentRepository,
      mockPaymentSessionRepository,
      mockMercadoPagoService,
      mockPaymentConfigService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.MP_NOTIFICATION_URL;
  });

  describe('flujo exitoso', () => {
    it('crea el Payment, la preferencia en MP y la sesión, y retorna el resultado', async () => {
      mockOrderRepository.findById.mockResolvedValue(mockOrder);

      const result = await useCase.execute({ orderId, userId, connectionId });

      expect(mockPaymentConfigService.getForCharging).toHaveBeenCalledTimes(1);
      expect(mockPaymentRepository.create).toHaveBeenCalledWith({
        orderId,
        userId,
        amount: 150.50,
        currency: 'MXN',
        status: PaymentStatus.PENDING,
        paymentMethod: PaymentMethod.QR_MERCADO_PAGO,
        gateway: PaymentGateway.MERCADO_PAGO,
      });
      expect(mockMercadoPagoService.createPreference).toHaveBeenCalledWith({
        orderId,
        branchId,
        title: `Orden #${orderId.slice(0, 8)} - Restify`,
        description: 'Pago de orden',
        amount: 150.50,
        currency: 'MXN',
        metadata: { orderId, paymentId },
        notificationUrl: `https://api.restify.com/webhooks/mercado-pago?branchId=${branchId}`,
        expirationDate: expect.any(String),
      });
      expect(mockPaymentRepository.update).toHaveBeenCalledWith(paymentId, {
        gatewayTransactionId: 'pref-abc',
      });
      expect(mockPaymentSessionRepository.create).toHaveBeenCalledWith({
        paymentId,
        clientSecret: preferenceResult.initPoint,
        connectionId,
        expiresAt: expect.any(Date),
      });

      expect(result).toEqual({
        paymentId,
        preferenceId: 'pref-abc',
        initPoint: preferenceResult.initPoint,
        expiresAt: expect.any(Date),
      });
    });
  });

  describe('validaciones', () => {
    it('lanza ORDER_NOT_FOUND cuando la orden no existe', async () => {
      mockOrderRepository.findById.mockResolvedValue(null);

      await expect(useCase.execute({ orderId, userId })).rejects.toMatchObject({
        code: 'ORDER_NOT_FOUND',
      });
      expect(mockPaymentRepository.create).not.toHaveBeenCalled();
      expect(mockMercadoPagoService.createPreference).not.toHaveBeenCalled();
    });

    it('lanza ORDER_ALREADY_PAID cuando la orden ya está pagada', async () => {
      mockOrderRepository.findById.mockResolvedValue(paidOrder);

      await expect(useCase.execute({ orderId, userId })).rejects.toMatchObject({
        code: 'ORDER_ALREADY_PAID',
      });
      expect(mockPaymentRepository.create).not.toHaveBeenCalled();
      expect(mockMercadoPagoService.createPreference).not.toHaveBeenCalled();
    });

    it('falla si el comercio no tiene cuenta de MP configurada (nunca cobra con la del env)', async () => {
      mockOrderRepository.findById.mockResolvedValue(mockOrder);
      mockPaymentConfigService.getForCharging.mockRejectedValue(
        Object.assign(new Error('no config'), { code: 'MERCHANT_PAYMENT_ACCOUNT_NOT_CONFIGURED' })
      );

      await expect(useCase.execute({ orderId, userId })).rejects.toMatchObject({
        code: 'MERCHANT_PAYMENT_ACCOUNT_NOT_CONFIGURED',
      });
      expect(mockPaymentRepository.create).not.toHaveBeenCalled();
      expect(mockMercadoPagoService.createPreference).not.toHaveBeenCalled();
    });
  });

  describe('reuso de preferencia pendiente', () => {
    it('reutiliza el pago MP pendiente cuando su sesión sigue vigente', async () => {
      mockOrderRepository.findById.mockResolvedValue(mockOrder);
      mockPaymentRepository.findAll.mockResolvedValue([pendingMPPayment]);
      const validSession = new PaymentSession('session-vigente', pendingMPPayment.id, 'https://init-point', null, new Date(Date.now() + 10 * 60 * 1000), new Date());
      mockPaymentSessionRepository.findByPaymentId.mockResolvedValue(validSession);

      const result = await useCase.execute({ orderId, userId });

      expect(mockPaymentRepository.create).not.toHaveBeenCalled();
      expect(mockMercadoPagoService.createPreference).not.toHaveBeenCalled();
      expect(result).toEqual({
        paymentId: pendingMPPayment.id,
        preferenceId: pendingMPPayment.gatewayTransactionId,
        initPoint: validSession.clientSecret,
        expiresAt: validSession.expiresAt,
      });
    });

    it('descarta la sesión expirada, cancela el pago viejo y crea uno nuevo', async () => {
      mockOrderRepository.findById.mockResolvedValue(mockOrder);
      mockPaymentRepository.findAll.mockResolvedValue([pendingMPPayment]);
      const expiredSession = new PaymentSession('session-vencida', pendingMPPayment.id, 'https://init-point-viejo', null, new Date(Date.now() - 1000), new Date());
      mockPaymentSessionRepository.findByPaymentId.mockResolvedValue(expiredSession);

      const result = await useCase.execute({ orderId, userId });

      expect(mockPaymentSessionRepository.deleteByPaymentId).toHaveBeenCalledWith(pendingMPPayment.id);
      expect(mockPaymentRepository.update).toHaveBeenCalledWith(pendingMPPayment.id, {
        status: PaymentStatus.CANCELED,
      });
      expect(mockPaymentRepository.create).toHaveBeenCalled();
      expect(mockMercadoPagoService.createPreference).toHaveBeenCalled();
      expect(result.paymentId).toBe(paymentId);
    });

    it('ignora pagos pendientes de otro gateway (solo reutiliza MERCADO_PAGO)', async () => {
      mockOrderRepository.findById.mockResolvedValue(mockOrder);
      const stripePending = new Payment(
        'payment-stripe', orderId, userId, 150.50, 'MXN',
        PaymentStatus.PENDING, PaymentMethod.CARD_STRIPE,
        PaymentGateway.STRIPE, 'pi_123', null, new Date(), new Date()
      );
      mockPaymentRepository.findAll.mockResolvedValue([stripePending]);

      await useCase.execute({ orderId, userId });

      expect(mockPaymentRepository.create).toHaveBeenCalled();
      expect(mockMercadoPagoService.createPreference).toHaveBeenCalled();
    });
  });

  describe('buildNotificationUrl', () => {
    it('agrega branchId como query param cuando hay branch', () => {
      const url = buildNotificationUrl('branch-789');
      expect(url).toBe('https://api.restify.com/webhooks/mercado-pago?branchId=branch-789');
    });

    it('devuelve la base sin cambios cuando no hay branchId', () => {
      expect(buildNotificationUrl(undefined)).toBe('https://api.restify.com/webhooks/mercado-pago');
    });

    it('devuelve string vacío si MP_NOTIFICATION_URL no está configurada', () => {
      delete process.env.MP_NOTIFICATION_URL;
      expect(buildNotificationUrl('branch-789')).toBe('');
    });
  });
});
