import { PayPublicOrderUseCase } from '../../../../src/core/application/use-cases/payments/pay-public-order.use-case';
import { IOrderRepository } from '../../../../src/core/domain/interfaces/order-repository.interface';
import { IPaymentRepository } from '../../../../src/core/domain/interfaces/payment-repository.interface';
import { IPaymentSessionRepository } from '../../../../src/core/domain/interfaces/payment-session-repository.interface';
import { MercadoPagoService } from '../../../../src/core/infrastructure/payment-gateways/mercado-pago.service';
import { PaymentConfigService } from '../../../../src/core/application/services/payment-config.service';
import { TenantResolverService } from '../../../../src/core/application/services/tenant-resolver.service';
import { AppError } from '../../../../src/shared/errors';
import * as tenantContext from '../../../../src/core/infrastructure/tenant/tenant-context';
import { Payment } from '../../../../src/core/domain/entities/payment.entity';
import { PaymentSession } from '../../../../src/core/domain/entities/payment-session.entity';
import { Order } from '../../../../src/core/domain/entities/order.entity';
import { Branch } from '../../../../src/core/domain/entities/branch.entity';
import { PaymentStatus, PaymentMethod, PaymentGateway } from '@prisma/client';

describe('PayPublicOrderUseCase', () => {
  let useCase: PayPublicOrderUseCase;
  let mockOrderRepository: jest.Mocked<IOrderRepository>;
  let mockPaymentRepository: jest.Mocked<IPaymentRepository>;
  let mockPaymentSessionRepository: jest.Mocked<IPaymentSessionRepository>;
  let mockMercadoPagoService: jest.Mocked<MercadoPagoService>;
  let mockPaymentConfigService: jest.Mocked<PaymentConfigService>;
  let mockTenantResolver: jest.Mocked<TenantResolverService>;
  let runWithTenantSpy: jest.SpyInstance;

  const orderId = 'order-123';
  const paymentId = 'payment-123';
  const branchId = 'branch-456';
  const organizationId = 'org-789';

  const publicOrder = new Order(
    orderId, new Date(), false, null, 150.50, 129.74, 20.76,
    false, null, 0, 'online-delivery', null, false, null, null,
    'Juan Perez', '5551234567', null, null, null, null, null, null,
    branchId, new Date(), new Date()
  );

  const paidOrder = new Order(
    orderId, new Date(), true, null, 150.50, 129.74, 20.76,
    false, null, 0, 'online-delivery', null, false, null, null,
    'Juan Perez', '5551234567', null, null, null, null, null, null,
    branchId, new Date(), new Date()
  );

  const privateOrder = new Order(
    orderId, new Date(), false, null, 150.50, 129.74, 20.76,
    false, null, 0, 'Local', null, false, null, 'user-123',
    null, null, null, null, null, null, null, null,
    branchId, new Date(), new Date()
  );

  const legacyOrder = new Order(
    orderId, new Date(), false, null, 150.50, 129.74, 20.76,
    false, null, 0, 'online-delivery', null, false, null, null,
    'Juan Perez', '5551234567', null, null, null, null, null, null,
    null, new Date(), new Date()
  );

  const branch = new Branch(
    branchId, organizationId, 'Sucursal Centro', 'Jalisco', 'Guadalajara',
    'Av. Juarez', '123', '5551234567', null, null, null, null, null, null,
    'America/Mexico_City', 'MXN', 'active', new Date(), new Date(), null
  );

  const createdPayment = new Payment(
    paymentId, orderId, null, 150.50, 'MXN',
    PaymentStatus.PENDING, PaymentMethod.QR_MERCADO_PAGO,
    PaymentGateway.MERCADO_PAGO, null, null, new Date(), new Date()
  );

  const pendingMPPayment = new Payment(
    'payment-existing', orderId, null, 150.50, 'MXN',
    PaymentStatus.PENDING, PaymentMethod.QR_MERCADO_PAGO,
    PaymentGateway.MERCADO_PAGO, 'pref-existing', null, new Date(), new Date()
  );

  const stripePendingPayment = new Payment(
    'payment-stripe', orderId, null, 150.50, 'MXN',
    PaymentStatus.PENDING, PaymentMethod.CARD_STRIPE,
    PaymentGateway.STRIPE, 'pi_123', null, new Date(), new Date()
  );

  const preferenceResult = {
    id: 'pref-abc',
    initPoint: 'https://www.mercadopago.com.mx/checkout/v1/redirect?pref_id=pref-abc',
    sandboxInitPoint: 'https://sandbox.mercadopago.com.mx/checkout/v1/redirect?pref_id=pref-abc',
    expirationDate: null,
  };

  const validSession = new PaymentSession(
    'session-vigente', pendingMPPayment.id, 'https://init.mercadopago.com/reuse', null,
    new Date(Date.now() + 10 * 60 * 1000), new Date()
  );

  const expiredSession = new PaymentSession(
    'session-vencida', pendingMPPayment.id, 'https://init.mercadopago.com/viejo', null,
    new Date(Date.now() - 1000), new Date()
  );

  beforeEach(() => {
    process.env.MP_NOTIFICATION_URL = 'https://api.restify.com/webhooks/mercado-pago';

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
      findAll: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue(createdPayment),
      update: jest.fn().mockImplementation(async (id: string, data: any) =>
        new Payment(id, orderId, null, 150.50, 'MXN',
          data.status ?? PaymentStatus.PENDING, PaymentMethod.QR_MERCADO_PAGO,
          PaymentGateway.MERCADO_PAGO, data.gatewayTransactionId ?? null, null, new Date(), new Date())
      ),
      delete: jest.fn(),
    };

    mockPaymentSessionRepository = {
      findById: jest.fn(),
      findByPaymentId: jest.fn(),
      create: jest.fn().mockImplementation(async (data: any) =>
        new PaymentSession('session-new', data.paymentId, data.clientSecret, data.connectionId ?? null, data.expiresAt, new Date())
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
      getForCharging: jest.fn().mockResolvedValue({
        mercadoPago: { accessToken: 'token-branch', webhookSecret: '' },
      }),
    } as any;

    mockTenantResolver = {
      resolve: jest.fn().mockResolvedValue({
        ok: true,
        tenant: { organizationId, branchId },
        branch,
      }),
    } as any;

    runWithTenantSpy = jest.spyOn(tenantContext, 'runWithTenant');

    useCase = new PayPublicOrderUseCase(
      mockOrderRepository,
      mockPaymentRepository,
      mockPaymentSessionRepository,
      mockMercadoPagoService,
      mockPaymentConfigService,
      mockTenantResolver,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    delete process.env.MP_NOTIFICATION_URL;
  });

  describe('validaciones', () => {
    it('lanza ORDER_NOT_FOUND cuando la orden no existe', async () => {
      mockOrderRepository.findById.mockResolvedValue(null);

      await expect(useCase.execute({ orderId })).rejects.toMatchObject({
        code: 'ORDER_NOT_FOUND',
      });
      expect(mockPaymentRepository.findAll).not.toHaveBeenCalled();
      expect(mockPaymentRepository.create).not.toHaveBeenCalled();
      expect(mockMercadoPagoService.createPreference).not.toHaveBeenCalled();
    });

    it('lanza ORDER_ALREADY_PAID cuando la orden ya está pagada', async () => {
      mockOrderRepository.findById.mockResolvedValue(paidOrder);

      await expect(useCase.execute({ orderId })).rejects.toMatchObject({
        code: 'ORDER_ALREADY_PAID',
      });
      expect(mockPaymentRepository.create).not.toHaveBeenCalled();
      expect(mockMercadoPagoService.createPreference).not.toHaveBeenCalled();
    });

    it('lanza VALIDATION_ERROR cuando la orden tiene userId (solo públicas)', async () => {
      mockOrderRepository.findById.mockResolvedValue(privateOrder);

      await expect(useCase.execute({ orderId })).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        message: expect.stringContaining('public'),
      });
      expect(mockPaymentRepository.create).not.toHaveBeenCalled();
      expect(mockMercadoPagoService.createPreference).not.toHaveBeenCalled();
    });
  });

  describe('resolución de tenant', () => {
    it('ejecuta dentro de runWithTenant con org y branch cuando la branch existe', async () => {
      mockOrderRepository.findById.mockResolvedValue(publicOrder);

      const result = await useCase.execute({ orderId });

      expect(mockTenantResolver.resolve).toHaveBeenCalledWith(branchId, { requireActiveBranch: true });
      expect(runWithTenantSpy).toHaveBeenCalledWith(
        { organizationId, branchId },
        expect.any(Function)
      );
      expect(result).toEqual({
        paymentId,
        preferenceId: 'pref-abc',
        initPoint: preferenceResult.initPoint,
        expiresAt: expect.any(Date),
      });
    });

    it('lanza BRANCH_NOT_FOUND cuando la branch no se encuentra: nunca cobra sin tenant', async () => {
      mockOrderRepository.findById.mockResolvedValue(publicOrder);
      mockTenantResolver.resolve.mockResolvedValue({ ok: false, reason: 'BRANCH_NOT_FOUND' });

      await expect(useCase.execute({ orderId })).rejects.toMatchObject({
        code: 'BRANCH_NOT_FOUND',
      });
      expect(runWithTenantSpy).not.toHaveBeenCalled();
      expect(mockPaymentRepository.create).not.toHaveBeenCalled();
      expect(mockMercadoPagoService.createPreference).not.toHaveBeenCalled();
    });

    it('lanza ORGANIZATION_INACTIVE cuando la organización no está activa', async () => {
      mockOrderRepository.findById.mockResolvedValue(publicOrder);
      mockTenantResolver.resolve.mockResolvedValue({
        ok: false,
        reason: 'ORGANIZATION_INACTIVE',
        organizationId,
        orgStatus: 'CLOSED',
      });

      await expect(useCase.execute({ orderId })).rejects.toMatchObject({
        code: 'ORGANIZATION_INACTIVE',
      });
      expect(mockMercadoPagoService.createPreference).not.toHaveBeenCalled();
    });

    it('rechaza órdenes sin branchId: nunca cobra sin tenant (legacy eliminado)', async () => {
      mockOrderRepository.findById.mockResolvedValue(legacyOrder);

      await expect(useCase.execute({ orderId })).rejects.toMatchObject({
        code: 'ORDER_NOT_FOUND',
      });
      expect(mockTenantResolver.resolve).not.toHaveBeenCalled();
      expect(runWithTenantSpy).not.toHaveBeenCalled();
      expect(mockMercadoPagoService.createPreference).not.toHaveBeenCalled();
    });
  });

  describe('cuenta de MP del comercio', () => {
    it('lanza MERCHANT_PAYMENT_ACCOUNT_NOT_CONFIGURED si el branch no configuró su cuenta, sin crear nada', async () => {
      mockOrderRepository.findById.mockResolvedValue(publicOrder);
      mockPaymentConfigService.getForCharging.mockRejectedValue(
        new AppError('MERCHANT_PAYMENT_ACCOUNT_NOT_CONFIGURED')
      );

      await expect(useCase.execute({ orderId })).rejects.toMatchObject({
        code: 'MERCHANT_PAYMENT_ACCOUNT_NOT_CONFIGURED',
      });
      expect(mockPaymentRepository.create).not.toHaveBeenCalled();
      expect(mockMercadoPagoService.createPreference).not.toHaveBeenCalled();
    });
  });

  describe('flujo exitoso', () => {
    it('crea el Payment PENDING, la preferencia en MP y la PaymentSession, y retorna el resultado', async () => {
      mockOrderRepository.findById.mockResolvedValue(publicOrder);

      const result = await useCase.execute({ orderId });

      expect(mockPaymentRepository.findAll).toHaveBeenCalledWith({
        orderIds: [orderId],
        status: PaymentStatus.PENDING,
      });
      expect(mockPaymentRepository.create).toHaveBeenCalledWith({
        orderId,
        userId: null,
        amount: 150.50,
        currency: 'MXN',
        status: PaymentStatus.PENDING,
        paymentMethod: PaymentMethod.QR_MERCADO_PAGO,
        gateway: PaymentGateway.MERCADO_PAGO,
      });
      expect(mockMercadoPagoService.createPreference).toHaveBeenCalledWith({
        orderId,
        branchId,
        title: `Pedido online #${orderId.slice(0, 8)} - Restify`,
        description: 'Pedido de Juan Perez',
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

  describe('reuso de pago MP pendiente', () => {
    it('reutiliza el pago MP pendiente cuando su sesión sigue vigente sin crear duplicados', async () => {
      mockOrderRepository.findById.mockResolvedValue(publicOrder);
      mockPaymentRepository.findAll.mockResolvedValue([pendingMPPayment]);
      mockPaymentSessionRepository.findByPaymentId.mockResolvedValue(validSession);

      const result = await useCase.execute({ orderId });

      expect(mockPaymentRepository.create).not.toHaveBeenCalled();
      expect(mockMercadoPagoService.createPreference).not.toHaveBeenCalled();
      expect(mockPaymentRepository.update).not.toHaveBeenCalled();
      expect(result).toEqual({
        paymentId: pendingMPPayment.id,
        preferenceId: pendingMPPayment.gatewayTransactionId,
        initPoint: validSession.clientSecret,
        expiresAt: validSession.expiresAt,
      });
    });

    it('descarta la sesión expirada, cancela el pago viejo y crea uno nuevo', async () => {
      mockOrderRepository.findById.mockResolvedValue(publicOrder);
      mockPaymentRepository.findAll.mockResolvedValue([pendingMPPayment]);
      mockPaymentSessionRepository.findByPaymentId.mockResolvedValue(expiredSession);

      const result = await useCase.execute({ orderId });

      expect(mockPaymentSessionRepository.deleteByPaymentId).toHaveBeenCalledWith(pendingMPPayment.id);
      expect(mockPaymentRepository.update).toHaveBeenCalledWith(pendingMPPayment.id, {
        status: PaymentStatus.CANCELED,
      });
      expect(mockPaymentRepository.create).toHaveBeenCalled();
      expect(mockMercadoPagoService.createPreference).toHaveBeenCalled();
      expect(result.paymentId).toBe(paymentId);
    });

    it('ignora pagos pendientes de otro gateway: no los reutiliza ni los cancela, y crea uno MP nuevo', async () => {
      mockOrderRepository.findById.mockResolvedValue(publicOrder);
      mockPaymentRepository.findAll.mockResolvedValue([stripePendingPayment]);

      const result = await useCase.execute({ orderId });

      expect(mockPaymentRepository.create).toHaveBeenCalled();
      expect(mockMercadoPagoService.createPreference).toHaveBeenCalled();
      expect(mockPaymentRepository.update).not.toHaveBeenCalledWith(
        stripePendingPayment.id,
        expect.anything()
      );
      expect(result.paymentId).toBe(paymentId);
    });
  });
});
