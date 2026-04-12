import { ConfirmMercadoPagoPaymentUseCase } from '../../../../src/core/application/use-cases/payments/confirm-mercado-pago-payment.use-case';
import { IPaymentRepository } from '../../../../src/core/domain/interfaces/payment-repository.interface';
import { IOrderRepository } from '../../../../src/core/domain/interfaces/order-repository.interface';
import { ITableRepository } from '../../../../src/core/domain/interfaces/table-repository.interface';
import { MercadoPagoService } from '../../../../src/core/infrastructure/payment-gateways/mercado-pago.service';
import { Payment } from '../../../../src/core/domain/entities/payment.entity';
import { Order } from '../../../../src/core/domain/entities/order.entity';
import { Table } from '../../../../src/core/domain/entities/table.entity';
import { PaymentStatus, PaymentMethod, PaymentGateway } from '@prisma/client';

describe('ConfirmMercadoPagoPaymentUseCase', () => {
  let useCase: ConfirmMercadoPagoPaymentUseCase;
  let mockPaymentRepository: jest.Mocked<IPaymentRepository>;
  let mockOrderRepository: jest.Mocked<IOrderRepository>;
  let mockTableRepository: jest.Mocked<ITableRepository>;
  let mockMercadoPagoService: jest.Mocked<MercadoPagoService>;

  const orderId = 'order-123';
  const userId = 'user-123';
  const paymentId = 'payment-123';

  const pendingPayment = new Payment(
    paymentId, orderId, userId, 150.50, 'MXN',
    PaymentStatus.PENDING, PaymentMethod.QR_MERCADO_PAGO,
    PaymentGateway.MERCADO_PAGO, 'pref-abc', null, new Date(), new Date()
  );

  const mockOrder = new Order(
    orderId, new Date(), false, null, 150.50, 129.74, 20.76,
    false, 'table-1', 0, 'Local', null, false, null, userId, null, null, null, null, null, null, null, new Date(), new Date()
  );

  beforeEach(() => {
    mockPaymentRepository = {
      findById: jest.fn(),
      findByGatewayTransactionId: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    mockOrderRepository = {
      findById: jest.fn(),
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

    mockTableRepository = {
      findById: jest.fn(),
      findByName: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    mockMercadoPagoService = {
      createPreference: jest.fn(),
      getPreference: jest.fn(),
      getPayment: jest.fn(),
      validateWebhookSignature: jest.fn(),
    } as any;

    useCase = new ConfirmMercadoPagoPaymentUseCase(
      mockPaymentRepository,
      mockOrderRepository,
      mockTableRepository,
      mockMercadoPagoService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('status mapping: approved → SUCCEEDED', () => {
    it('should confirm payment, update order and release table', async () => {
      mockMercadoPagoService.getPayment.mockResolvedValue({
        id: 99999,
        status: 'approved',
        statusDetail: 'accredited',
        externalReference: orderId,
        transactionAmount: 150.50,
        currencyId: 'MXN',
        paymentMethodId: 'visa',
        paymentTypeId: 'credit_card',
        dateApproved: '2026-03-27T12:00:00.000Z',
      });

      mockPaymentRepository.findAll.mockResolvedValue([pendingPayment]);

      const updatedPayment = new Payment(
        paymentId, orderId, userId, 150.50, 'MXN',
        PaymentStatus.SUCCEEDED, PaymentMethod.QR_MERCADO_PAGO,
        PaymentGateway.MERCADO_PAGO, '99999', null, new Date(), new Date()
      );
      mockPaymentRepository.update.mockResolvedValue(updatedPayment);

      mockOrderRepository.findById.mockResolvedValue(mockOrder);

      const updatedOrder = new Order(
        orderId, new Date(), true, 4, 150.50, 129.74, 20.76,
        false, 'table-1', 0, 'Local', null, false, null, userId, null, null, null, null, null, null, null, new Date(), new Date()
      );
      mockOrderRepository.update.mockResolvedValue(updatedOrder);

      const mockTable = new Table('table-1', 'Mesa 1', userId, true, true, new Date(), new Date());
      mockTableRepository.update.mockResolvedValue(mockTable);

      const result = await useCase.execute({ mpPaymentId: 99999, action: 'payment.updated' });

      expect(result).not.toBeNull();
      expect(result!.payment.status).toBe(PaymentStatus.SUCCEEDED);
      expect(result!.order?.status).toBe(true);
      expect(result!.order?.paymentMethod).toBe(4);
      expect(result!.tableReleased).toBe(true);

      expect(mockPaymentRepository.update).toHaveBeenCalledWith(paymentId, {
        status: PaymentStatus.SUCCEEDED,
        gatewayTransactionId: '99999',
      });
      expect(mockOrderRepository.update).toHaveBeenCalledWith(orderId, {
        status: true,
        paymentMethod: 4,
        delivered: true,
      });
      expect(mockTableRepository.update).toHaveBeenCalledWith('table-1', {
        availabilityStatus: true,
      });
    });
  });

  describe('status mapping: rejected → FAILED', () => {
    it('should update payment to FAILED and not update order', async () => {
      mockMercadoPagoService.getPayment.mockResolvedValue({
        id: 99999,
        status: 'rejected',
        statusDetail: 'cc_rejected_other_reason',
        externalReference: orderId,
        transactionAmount: 150.50,
        currencyId: 'MXN',
        paymentMethodId: 'visa',
        paymentTypeId: 'credit_card',
        dateApproved: null,
      });

      mockPaymentRepository.findAll.mockResolvedValue([pendingPayment]);

      const updatedPayment = new Payment(
        paymentId, orderId, userId, 150.50, 'MXN',
        PaymentStatus.FAILED, PaymentMethod.QR_MERCADO_PAGO,
        PaymentGateway.MERCADO_PAGO, '99999', null, new Date(), new Date()
      );
      mockPaymentRepository.update.mockResolvedValue(updatedPayment);

      const result = await useCase.execute({ mpPaymentId: 99999, action: 'payment.updated' });

      expect(result).not.toBeNull();
      expect(result!.payment.status).toBe(PaymentStatus.FAILED);
      expect(result!.order).toBeUndefined();
      expect(result!.tableReleased).toBe(false);
    });
  });

  describe('status mapping: pending → PROCESSING', () => {
    it('should update payment to PROCESSING and not close order', async () => {
      mockMercadoPagoService.getPayment.mockResolvedValue({
        id: 99999,
        status: 'pending',
        statusDetail: 'pending_waiting_transfer',
        externalReference: orderId,
        transactionAmount: 150.50,
        currencyId: 'MXN',
        paymentMethodId: 'bank_transfer',
        paymentTypeId: 'bank_transfer',
        dateApproved: null,
      });

      mockPaymentRepository.findAll.mockResolvedValue([pendingPayment]);

      const updatedPayment = new Payment(
        paymentId, orderId, userId, 150.50, 'MXN',
        PaymentStatus.PROCESSING, PaymentMethod.QR_MERCADO_PAGO,
        PaymentGateway.MERCADO_PAGO, '99999', null, new Date(), new Date()
      );
      mockPaymentRepository.update.mockResolvedValue(updatedPayment);

      const result = await useCase.execute({ mpPaymentId: 99999, action: 'payment.created' });

      expect(result).not.toBeNull();
      expect(result!.payment.status).toBe(PaymentStatus.PROCESSING);
      expect(result!.order).toBeUndefined();
    });
  });

  describe('status mapping: cancelled → CANCELED', () => {
    it('should update payment to CANCELED', async () => {
      mockMercadoPagoService.getPayment.mockResolvedValue({
        id: 99999,
        status: 'cancelled',
        statusDetail: 'expired',
        externalReference: orderId,
        transactionAmount: 150.50,
        currencyId: 'MXN',
        paymentMethodId: 'visa',
        paymentTypeId: 'credit_card',
        dateApproved: null,
      });

      mockPaymentRepository.findAll.mockResolvedValue([pendingPayment]);

      const updatedPayment = new Payment(
        paymentId, orderId, userId, 150.50, 'MXN',
        PaymentStatus.CANCELED, PaymentMethod.QR_MERCADO_PAGO,
        PaymentGateway.MERCADO_PAGO, '99999', null, new Date(), new Date()
      );
      mockPaymentRepository.update.mockResolvedValue(updatedPayment);

      const result = await useCase.execute({ mpPaymentId: 99999, action: 'payment.updated' });

      expect(result).not.toBeNull();
      expect(result!.payment.status).toBe(PaymentStatus.CANCELED);
      expect(result!.order).toBeUndefined();
    });
  });

  describe('status mapping: in_process → PROCESSING', () => {
    it('should map in_process to PROCESSING', async () => {
      mockMercadoPagoService.getPayment.mockResolvedValue({
        id: 99999,
        status: 'in_process',
        statusDetail: 'pending_review_manual',
        externalReference: orderId,
        transactionAmount: 150.50,
        currencyId: 'MXN',
        paymentMethodId: 'visa',
        paymentTypeId: 'credit_card',
        dateApproved: null,
      });

      mockPaymentRepository.findAll.mockResolvedValue([pendingPayment]);

      const updatedPayment = new Payment(
        paymentId, orderId, userId, 150.50, 'MXN',
        PaymentStatus.PROCESSING, PaymentMethod.QR_MERCADO_PAGO,
        PaymentGateway.MERCADO_PAGO, '99999', null, new Date(), new Date()
      );
      mockPaymentRepository.update.mockResolvedValue(updatedPayment);

      const result = await useCase.execute({ mpPaymentId: 99999, action: 'payment.updated' });

      expect(result).not.toBeNull();
      expect(result!.payment.status).toBe(PaymentStatus.PROCESSING);
    });
  });

  describe('idempotency', () => {
    it('should return null when no pending MP payment exists', async () => {
      mockMercadoPagoService.getPayment.mockResolvedValue({
        id: 99999,
        status: 'approved',
        statusDetail: 'accredited',
        externalReference: orderId,
        transactionAmount: 150.50,
        currencyId: 'MXN',
        paymentMethodId: 'visa',
        paymentTypeId: 'credit_card',
        dateApproved: '2026-03-27T12:00:00.000Z',
      });

      mockPaymentRepository.findAll.mockResolvedValue([]);

      const result = await useCase.execute({ mpPaymentId: 99999, action: 'payment.updated' });

      expect(result).toBeNull();
      expect(mockPaymentRepository.update).not.toHaveBeenCalled();
      expect(mockOrderRepository.update).not.toHaveBeenCalled();
    });

    it('should return null when external_reference is missing', async () => {
      mockMercadoPagoService.getPayment.mockResolvedValue({
        id: 99999,
        status: 'approved',
        statusDetail: 'accredited',
        externalReference: '',
        transactionAmount: 150.50,
        currencyId: 'MXN',
        paymentMethodId: 'visa',
        paymentTypeId: 'credit_card',
        dateApproved: null,
      });

      const result = await useCase.execute({ mpPaymentId: 99999, action: 'payment.updated' });

      expect(result).toBeNull();
    });
  });

  describe('status mapping: unknown status → null', () => {
    it('should return null when MP returns an unknown status', async () => {
      mockMercadoPagoService.getPayment.mockResolvedValue({
        id: 99999,
        status: 'some_unknown_status',
        statusDetail: 'unknown',
        externalReference: orderId,
        transactionAmount: 150.50,
        currencyId: 'MXN',
        paymentMethodId: 'visa',
        paymentTypeId: 'credit_card',
        dateApproved: null,
      });

      mockPaymentRepository.findAll.mockResolvedValue([pendingPayment]);

      const result = await useCase.execute({ mpPaymentId: 99999, action: 'payment.updated' });

      expect(result).toBeNull();
      expect(mockPaymentRepository.update).not.toHaveBeenCalled();
      expect(mockOrderRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('table release', () => {
    it('should not release table for non-local orders', async () => {
      const deliveryOrder = new Order(
        orderId, new Date(), false, null, 150.50, 129.74, 20.76,
        false, null, 0, 'Delivery', null, false, null, userId, null, null, null, null, null, null, null, new Date(), new Date()
      );

      mockMercadoPagoService.getPayment.mockResolvedValue({
        id: 99999,
        status: 'approved',
        statusDetail: 'accredited',
        externalReference: orderId,
        transactionAmount: 150.50,
        currencyId: 'MXN',
        paymentMethodId: 'visa',
        paymentTypeId: 'credit_card',
        dateApproved: '2026-03-27T12:00:00.000Z',
      });

      mockPaymentRepository.findAll.mockResolvedValue([pendingPayment]);

      const updatedPayment = new Payment(
        paymentId, orderId, userId, 150.50, 'MXN',
        PaymentStatus.SUCCEEDED, PaymentMethod.QR_MERCADO_PAGO,
        PaymentGateway.MERCADO_PAGO, '99999', null, new Date(), new Date()
      );
      mockPaymentRepository.update.mockResolvedValue(updatedPayment);
      mockOrderRepository.findById.mockResolvedValue(deliveryOrder);

      const updatedOrder = new Order(
        orderId, new Date(), true, 4, 150.50, 129.74, 20.76,
        false, null, 0, 'Delivery', null, false, null, userId, null, null, null, null, null, null, null, new Date(), new Date()
      );
      mockOrderRepository.update.mockResolvedValue(updatedOrder);

      const result = await useCase.execute({ mpPaymentId: 99999, action: 'payment.updated' });

      expect(result!.tableReleased).toBe(false);
      expect(mockTableRepository.update).not.toHaveBeenCalled();
    });
  });
});
