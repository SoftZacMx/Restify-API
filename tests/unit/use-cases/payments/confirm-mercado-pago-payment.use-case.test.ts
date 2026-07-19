import { ConfirmMercadoPagoPaymentUseCase } from '../../../../src/core/application/use-cases/payments/confirm-mercado-pago-payment.use-case';
import { CreateMercadoPagoFeeExpenseUseCase } from '../../../../src/core/application/use-cases/expenses/create-mercado-pago-fee-expense.use-case';
import { IPaymentRepository } from '../../../../src/core/domain/interfaces/payment-repository.interface';
import { IOrderRepository } from '../../../../src/core/domain/interfaces/order-repository.interface';
import { ITableRepository } from '../../../../src/core/domain/interfaces/table-repository.interface';
import { IBranchRepository } from '../../../../src/core/domain/interfaces/branch-repository.interface';
import { IOrganizationRepository } from '../../../../src/core/domain/interfaces/organization-repository.interface';
import { IPendingCheckoutRepository } from '../../../../src/core/domain/interfaces/pending-checkout-repository.interface';
import { PublicOrderPersistenceService } from '../../../../src/core/application/services/public-order-persistence.service';
import { MercadoPagoService } from '../../../../src/core/infrastructure/payment-gateways/mercado-pago.service';
import { Payment } from '../../../../src/core/domain/entities/payment.entity';
import { Order } from '../../../../src/core/domain/entities/order.entity';
import { Table } from '../../../../src/core/domain/entities/table.entity';
import { Branch } from '../../../../src/core/domain/entities/branch.entity';
import { PaymentStatus, PaymentMethod, PaymentGateway } from '@prisma/client';
import { getTenant } from '../../../../src/core/infrastructure/tenant/tenant-context';

describe('ConfirmMercadoPagoPaymentUseCase', () => {
  let useCase: ConfirmMercadoPagoPaymentUseCase;
  let mockPaymentRepository: jest.Mocked<IPaymentRepository>;
  let mockOrderRepository: jest.Mocked<IOrderRepository>;
  let mockTableRepository: jest.Mocked<ITableRepository>;
  let mockBranchRepository: jest.Mocked<IBranchRepository>;
  let mockOrganizationRepository: jest.Mocked<IOrganizationRepository>;
  let mockMercadoPagoService: jest.Mocked<MercadoPagoService>;
  let mockCreateMpFeeExpenseUseCase: jest.Mocked<CreateMercadoPagoFeeExpenseUseCase>;
  let mockPendingCheckoutRepository: jest.Mocked<IPendingCheckoutRepository>;
  let mockPersistence: jest.Mocked<PublicOrderPersistenceService>;

  const orderId = 'order-123';
  const userId = 'user-123';
  const paymentId = 'payment-123';
  const branchId = 'branch-456';
  const orgId = 'org-789';

  const mockBranch = new Branch(
    branchId, orgId, 'Sucursal Centro', 'CDMX', 'CDMX', 'Reforma', '100',
    '5551234567', null, null, null, null, null, null,
    'America/Mexico_City', 'MXN', 'active', new Date(), new Date(), null
  );

  const pendingPayment = new Payment(
    paymentId, orderId, userId, 150.50, 'MXN',
    PaymentStatus.PENDING, PaymentMethod.QR_MERCADO_PAGO,
    PaymentGateway.MERCADO_PAGO, 'pref-abc', null, new Date(), new Date()
  );

  const mockOrder = new Order(
    orderId, new Date(), false, null, 150.50, 129.74, 20.76,
    false, 'table-1', 0, 'Local', null, false, null, userId, null, null, null, null, null, null, null, null, null, new Date(), new Date()
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

    mockTableRepository = {
      findById: jest.fn(),
      findByName: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    mockBranchRepository = {
      findById: jest.fn(),
      findBySlug: jest.fn(),
      findByIdAndOrganizationId: jest.fn(),
      findAllIdsByOrganizationId: jest.fn(),
      findManyByOrganizationId: jest.fn(),
      findManyForList: jest.fn(),
      countActiveByOrganizationId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    } as any;

    mockOrganizationRepository = {
      // Por defecto la org está activa; los tests que necesiten una org inactiva lo sobreescriben.
      findById: jest.fn().mockResolvedValue({ id: 'org-789', status: 'ACTIVE' }),
    } as any;

    // Por defecto el branch existe; los tests de branch inexistente lo sobreescriben.
    mockBranchRepository.findById.mockResolvedValue(mockBranch);

    mockMercadoPagoService = {
      createPreference: jest.fn(),
      getPreference: jest.fn(),
      getPayment: jest.fn(),
      cancelPayment: jest.fn(),
      validateWebhookSignature: jest.fn(),
    } as any;

    mockCreateMpFeeExpenseUseCase = {
      execute: jest.fn().mockResolvedValue({ expenseId: null, created: false }),
    } as any;

    mockPendingCheckoutRepository = {
      findById: jest.fn(),
      findByTrackingToken: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };

    mockPersistence = {
      validateAndPrice: jest.fn(),
      persistOrder: jest.fn(),
    } as any;

    useCase = new ConfirmMercadoPagoPaymentUseCase(
      mockPaymentRepository,
      mockOrderRepository,
      mockTableRepository,
      mockBranchRepository,
      mockOrganizationRepository,
      mockPendingCheckoutRepository,
      mockMercadoPagoService,
      mockCreateMpFeeExpenseUseCase,
      mockPersistence,
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
        externalReference: `${orderId}:${branchId}`,
        transactionAmount: 150.50,
        currencyId: 'MXN',
        paymentMethodId: 'visa',
        paymentTypeId: 'credit_card',
        dateApproved: '2026-03-27T12:00:00.000Z',
        feeDetails: [],
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
        false, 'table-1', 0, 'Local', null, false, null, userId, null, null, null, null, null, null, null, null, null, new Date(), new Date()
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
        externalReference: `${orderId}:${branchId}`,
        transactionAmount: 150.50,
        currencyId: 'MXN',
        paymentMethodId: 'visa',
        paymentTypeId: 'credit_card',
        dateApproved: null,
        feeDetails: [],
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
        externalReference: `${orderId}:${branchId}`,
        transactionAmount: 150.50,
        currencyId: 'MXN',
        paymentMethodId: 'bank_transfer',
        paymentTypeId: 'bank_transfer',
        dateApproved: null,
        feeDetails: [],
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
        externalReference: `${orderId}:${branchId}`,
        transactionAmount: 150.50,
        currencyId: 'MXN',
        paymentMethodId: 'visa',
        paymentTypeId: 'credit_card',
        dateApproved: null,
        feeDetails: [],
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
        externalReference: `${orderId}:${branchId}`,
        transactionAmount: 150.50,
        currencyId: 'MXN',
        paymentMethodId: 'visa',
        paymentTypeId: 'credit_card',
        dateApproved: null,
        feeDetails: [],
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
        externalReference: `${orderId}:${branchId}`,
        transactionAmount: 150.50,
        currencyId: 'MXN',
        paymentMethodId: 'visa',
        paymentTypeId: 'credit_card',
        dateApproved: '2026-03-27T12:00:00.000Z',
        feeDetails: [],
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
        feeDetails: [],
      });

      const result = await useCase.execute({ mpPaymentId: 99999, action: 'payment.updated' });

      expect(result).toBeNull();
    });
  });

  describe('status mapping: unknown status → PROCESSING', () => {
    it('should register an unknown MP status as PROCESSING instead of discarding it', async () => {
      mockMercadoPagoService.getPayment.mockResolvedValue({
        id: 99999,
        status: 'some_unknown_status',
        statusDetail: 'unknown',
        externalReference: `${orderId}:${branchId}`,
        transactionAmount: 150.50,
        currencyId: 'MXN',
        paymentMethodId: 'visa',
        paymentTypeId: 'credit_card',
        dateApproved: null,
        feeDetails: [],
      });

      mockOrderRepository.findById.mockResolvedValue(mockOrder);
      mockPaymentRepository.findByGatewayTransactionId.mockResolvedValue(null);
      mockPaymentRepository.findAll.mockResolvedValue([pendingPayment]);
      mockPaymentRepository.update.mockResolvedValue(
        new Payment(paymentId, orderId, userId, 150.50, 'MXN', PaymentStatus.PROCESSING,
          PaymentMethod.QR_MERCADO_PAGO, PaymentGateway.MERCADO_PAGO, '99999', null, new Date(), new Date())
      );

      const result = await useCase.execute({ mpPaymentId: 99999, action: 'payment.updated' });

      // El pago se registra (no se pierde), pero la orden NO se marca pagada.
      expect(mockPaymentRepository.update).toHaveBeenCalledWith(paymentId, {
        status: PaymentStatus.PROCESSING,
        gatewayTransactionId: '99999',
      });
      expect(mockOrderRepository.update).not.toHaveBeenCalled();
      expect(result?.payment.status).toBe(PaymentStatus.PROCESSING);
    });
  });

  describe('autoservicio: pago in_process en orden pública', () => {
    it('cancela automáticamente el pago in_process y marca el Payment como CANCELED', async () => {
      const publicOrder = new Order(
        orderId, new Date(), false, null, 150.50, 129.74, 20.76,
        false, null, 0, 'online-pickup', null, false, null, null, null, null, null, null, null, null, null, null, null, new Date(), new Date()
      );

      mockMercadoPagoService.getPayment.mockResolvedValue({
        id: 99999,
        status: 'in_process',
        statusDetail: 'pending_review_manual',
        externalReference: `${orderId}:${branchId}`,
        transactionAmount: 150.50,
        currencyId: 'MXN',
        paymentMethodId: 'visa',
        paymentTypeId: 'credit_card',
        dateApproved: null,
        feeDetails: [],
      });
      mockMercadoPagoService.cancelPayment.mockResolvedValue({ status: 'cancelled', statusDetail: 'by_collector' });

      mockOrderRepository.findById.mockResolvedValue(publicOrder);
      mockPaymentRepository.findByGatewayTransactionId.mockResolvedValue(null);
      mockPaymentRepository.findAll.mockResolvedValue([pendingPayment]);
      mockPaymentRepository.update.mockResolvedValue(
        new Payment(paymentId, orderId, null, 150.50, 'MXN', PaymentStatus.CANCELED,
          PaymentMethod.QR_MERCADO_PAGO, PaymentGateway.MERCADO_PAGO, '99999', null, new Date(), new Date())
      );

      const result = await useCase.execute({ mpPaymentId: 99999, action: 'payment.updated' });

      expect(mockMercadoPagoService.cancelPayment).toHaveBeenCalledWith('99999');
      expect(mockPaymentRepository.update).toHaveBeenCalledWith(paymentId, {
        status: PaymentStatus.CANCELED,
        gatewayTransactionId: '99999',
      });
      expect(mockOrderRepository.update).not.toHaveBeenCalled();
      expect(result?.payment.status).toBe(PaymentStatus.CANCELED);
    });

    it('procesa como aprobado si el banco aprobó antes de poder cancelar', async () => {
      const publicOrder = new Order(
        orderId, new Date(), false, null, 150.50, 129.74, 20.76,
        false, null, 0, 'online-pickup', null, false, null, null, null, null, null, null, null, null, null, null, null, new Date(), new Date()
      );

      mockMercadoPagoService.getPayment.mockResolvedValue({
        id: 99999,
        status: 'in_process',
        statusDetail: 'pending_review_manual',
        externalReference: `${orderId}:${branchId}`,
        transactionAmount: 150.50,
        currencyId: 'MXN',
        paymentMethodId: 'visa',
        paymentTypeId: 'credit_card',
        dateApproved: '2026-07-18T23:16:42.000Z',
        feeDetails: [],
      });
      mockMercadoPagoService.cancelPayment.mockResolvedValue({ status: 'approved', statusDetail: 'accredited' });

      mockOrderRepository.findById.mockResolvedValue(publicOrder);
      mockPaymentRepository.findByGatewayTransactionId.mockResolvedValue(null);
      mockPaymentRepository.findAll.mockResolvedValue([pendingPayment]);
      mockPaymentRepository.update.mockResolvedValue(
        new Payment(paymentId, orderId, null, 150.50, 'MXN', PaymentStatus.SUCCEEDED,
          PaymentMethod.QR_MERCADO_PAGO, PaymentGateway.MERCADO_PAGO, '99999', null, new Date(), new Date())
      );
      mockOrderRepository.update.mockResolvedValue(
        new Order(orderId, new Date(), true, 4, 150.50, 129.74, 20.76, false, null, 0,
          'online-pickup', null, false, null, null, null, null, null, null, null, null, null, null, null, new Date(), new Date())
      );

      const result = await useCase.execute({ mpPaymentId: 99999, action: 'payment.updated' });

      // No debe cancelar el pago aprobado; debe marcar la orden pagada.
      expect(mockOrderRepository.update).toHaveBeenCalled();
      expect(result?.payment.status).toBe(PaymentStatus.SUCCEEDED);
    });
  });

  describe('table release', () => {
    it('should not release table for non-local orders', async () => {
      const deliveryOrder = new Order(
        orderId, new Date(), false, null, 150.50, 129.74, 20.76,
        false, null, 0, 'Delivery', null, false, null, userId, null, null, null, null, null, null, null, null, null, new Date(), new Date()
      );

      mockMercadoPagoService.getPayment.mockResolvedValue({
        id: 99999,
        status: 'approved',
        statusDetail: 'accredited',
        externalReference: `${orderId}:${branchId}`,
        transactionAmount: 150.50,
        currencyId: 'MXN',
        paymentMethodId: 'visa',
        paymentTypeId: 'credit_card',
        dateApproved: '2026-03-27T12:00:00.000Z',
        feeDetails: [],
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
        false, null, 0, 'Delivery', null, false, null, userId, null, null, null, null, null, null, null, null, null, new Date(), new Date()
      );
      mockOrderRepository.update.mockResolvedValue(updatedOrder);

      const result = await useCase.execute({ mpPaymentId: 99999, action: 'payment.updated' });

      expect(result!.tableReleased).toBe(false);
      expect(mockTableRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('online orders', () => {
    it('should NOT mark as delivered and should set deliveryStatus PAID for online orders', async () => {
      const onlineOrder = new Order(
        orderId, new Date(), false, null, 150.50, 129.74, 20.76,
        false, null, 0, 'online-delivery', null, false, null, null,
        'Juan', '5512345678', 19.43, -99.13, 'Calle 1', null, 'token-abc', null,
        null, new Date(), new Date()
      );

      mockMercadoPagoService.getPayment.mockResolvedValue({
        id: 99999,
        status: 'approved',
        statusDetail: 'accredited',
        externalReference: `${orderId}:${branchId}`,
        transactionAmount: 150.50,
        currencyId: 'MXN',
        paymentMethodId: 'account_money',
        paymentTypeId: 'account_money',
        dateApproved: '2026-04-12T12:00:00.000Z',
        feeDetails: [],
      });

      mockPaymentRepository.findAll.mockResolvedValue([pendingPayment]);

      const updatedPayment = new Payment(
        paymentId, orderId, null, 150.50, 'MXN',
        PaymentStatus.SUCCEEDED, PaymentMethod.QR_MERCADO_PAGO,
        PaymentGateway.MERCADO_PAGO, '99999', null, new Date(), new Date()
      );
      mockPaymentRepository.update.mockResolvedValue(updatedPayment);
      mockOrderRepository.findById.mockResolvedValue(onlineOrder);

      const updatedOrder = new Order(
        orderId, new Date(), true, 4, 150.50, 129.74, 20.76,
        false, null, 0, 'online-delivery', null, false, null, null,
        'Juan', '5512345678', 19.43, -99.13, 'Calle 1', null, 'token-abc', 'PAID',
        null, new Date(), new Date()
      );
      mockOrderRepository.update.mockResolvedValue(updatedOrder);

      const result = await useCase.execute({ mpPaymentId: 99999, action: 'payment.updated' });

      expect(result).not.toBeNull();
      expect(result!.order?.status).toBe(true);

      // Should NOT mark as delivered for online orders
      expect(mockOrderRepository.update).toHaveBeenCalledWith(orderId, {
        status: true,
        paymentMethod: 4,
        delivered: false,
        deliveryStatus: 'PAID',
      });

      // Should NOT release table (online orders have no table)
      expect(mockTableRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('Mercado Pago fee expense recording', () => {
    it('should record fee expense when MP returns fee_details on a successful payment', async () => {
      mockMercadoPagoService.getPayment.mockResolvedValue({
        id: 99999,
        status: 'approved',
        statusDetail: 'accredited',
        externalReference: `${orderId}:${branchId}`,
        transactionAmount: 150.50,
        currencyId: 'MXN',
        paymentMethodId: 'visa',
        paymentTypeId: 'credit_card',
        dateApproved: '2026-04-24T12:00:00.000Z',
        feeDetails: [
          { type: 'mercadopago_fee', amount: 5.25, feePayer: 'collector' },
          { type: 'financing_fee', amount: 1.10, feePayer: 'collector' },
        ],
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
        false, 'table-1', 0, 'Local', null, false, null, userId, null, null, null, null, null, null, null, null, null, new Date(), new Date()
      );
      mockOrderRepository.update.mockResolvedValue(updatedOrder);

      const mockTable = new Table('table-1', 'Mesa 1', userId, true, true, new Date(), new Date());
      mockTableRepository.update.mockResolvedValue(mockTable);

      await useCase.execute({ mpPaymentId: 99999, action: 'payment.updated' });

      expect(mockCreateMpFeeExpenseUseCase.execute).toHaveBeenCalledTimes(1);
      expect(mockCreateMpFeeExpenseUseCase.execute).toHaveBeenCalledWith({
        paymentId,
        orderId,
        mpPaymentId: 99999,
        feeAmount: 6.35, // 5.25 + 1.10
        date: new Date('2026-04-24T12:00:00.000Z'),
      });
    });

    it('should not record fee expense when feeDetails is empty', async () => {
      mockMercadoPagoService.getPayment.mockResolvedValue({
        id: 99999,
        status: 'approved',
        statusDetail: 'accredited',
        externalReference: `${orderId}:${branchId}`,
        transactionAmount: 150.50,
        currencyId: 'MXN',
        paymentMethodId: 'visa',
        paymentTypeId: 'credit_card',
        dateApproved: '2026-04-24T12:00:00.000Z',
        feeDetails: [],
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
        false, 'table-1', 0, 'Local', null, false, null, userId, null, null, null, null, null, null, null, null, null, new Date(), new Date()
      );
      mockOrderRepository.update.mockResolvedValue(updatedOrder);
      mockTableRepository.update.mockResolvedValue(
        new Table('table-1', 'Mesa 1', userId, true, true, new Date(), new Date())
      );

      await useCase.execute({ mpPaymentId: 99999, action: 'payment.updated' });

      expect(mockCreateMpFeeExpenseUseCase.execute).not.toHaveBeenCalled();
    });

    it('should not fail the payment confirmation if fee expense recording throws', async () => {
      mockMercadoPagoService.getPayment.mockResolvedValue({
        id: 99999,
        status: 'approved',
        statusDetail: 'accredited',
        externalReference: `${orderId}:${branchId}`,
        transactionAmount: 150.50,
        currencyId: 'MXN',
        paymentMethodId: 'visa',
        paymentTypeId: 'credit_card',
        dateApproved: '2026-04-24T12:00:00.000Z',
        feeDetails: [{ type: 'mercadopago_fee', amount: 5.25, feePayer: 'collector' }],
      });

      mockPaymentRepository.findAll.mockResolvedValue([pendingPayment]);

      const updatedPayment = new Payment(
        paymentId, orderId, userId, 150.50, 'MXN',
        PaymentStatus.SUCCEEDED, PaymentMethod.QR_MERCADO_PAGO,
        PaymentGateway.MERCADO_PAGO, '99999', null, new Date(), new Date()
      );
      mockPaymentRepository.update.mockResolvedValue(updatedPayment);
      mockOrderRepository.findById.mockResolvedValue(mockOrder);
      mockOrderRepository.update.mockResolvedValue(
        new Order(
          orderId, new Date(), true, 4, 150.50, 129.74, 20.76,
          false, 'table-1', 0, 'Local', null, false, null, userId, null, null, null, null, null, null, null, null, null, new Date(), new Date()
        )
      );
      mockTableRepository.update.mockResolvedValue(
        new Table('table-1', 'Mesa 1', userId, true, true, new Date(), new Date())
      );

      mockCreateMpFeeExpenseUseCase.execute.mockRejectedValueOnce(new Error('DB unavailable'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const result = await useCase.execute({ mpPaymentId: 99999, action: 'payment.updated' });

      expect(result).not.toBeNull();
      expect(result!.payment.status).toBe(PaymentStatus.SUCCEEDED);
      consoleSpy.mockRestore();
    });
  });

  describe('multi-tenant: branchId desde la notification_url', () => {
    function mockApprovedPayment(externalReference: string) {
      mockMercadoPagoService.getPayment.mockResolvedValue({
        id: 99999,
        status: 'approved',
        statusDetail: 'accredited',
        externalReference,
        transactionAmount: 150.50,
        currencyId: 'MXN',
        paymentMethodId: 'visa',
        paymentTypeId: 'credit_card',
        dateApproved: '2026-05-30T12:00:00.000Z',
        feeDetails: [],
      });
    }

    function mockSuccessfulProcessing() {
      mockPaymentRepository.findAll.mockResolvedValue([pendingPayment]);
      const updatedPayment = new Payment(
        paymentId, orderId, userId, 150.50, 'MXN',
        PaymentStatus.SUCCEEDED, PaymentMethod.QR_MERCADO_PAGO,
        PaymentGateway.MERCADO_PAGO, '99999', null, new Date(), new Date()
      );
      mockPaymentRepository.update.mockResolvedValue(updatedPayment);
      mockOrderRepository.findById.mockResolvedValue(mockOrder);
      mockOrderRepository.update.mockResolvedValue(
        new Order(
          orderId, new Date(), true, 4, 150.50, 129.74, 20.76,
          false, 'table-1', 0, 'Local', null, false, null, userId, null, null, null, null, null, null, null, null, null, new Date(), new Date()
        )
      );
      mockTableRepository.update.mockResolvedValue(
        new Table('table-1', 'Mesa 1', userId, true, true, new Date(), new Date())
      );
    }

    it('establece el tenant context ANTES de llamar a getPayment', async () => {
      let tenantDuringGetPayment: ReturnType<typeof getTenant>;
      mockSuccessfulProcessing();
      mockMercadoPagoService.getPayment.mockImplementation(async () => {
        tenantDuringGetPayment = getTenant();
        return {
          id: 99999,
          status: 'approved',
          statusDetail: 'accredited',
          externalReference: `${orderId}:${branchId}`,
          transactionAmount: 150.50,
          currencyId: 'MXN',
          paymentMethodId: 'visa',
          paymentTypeId: 'credit_card',
          dateApproved: '2026-05-30T12:00:00.000Z',
          feeDetails: [],
        };
      });

      const result = await useCase.execute({ mpPaymentId: 99999, action: 'payment.updated', branchId });

      expect(tenantDuringGetPayment).toEqual({ organizationId: orgId, branchId });
      expect(result).not.toBeNull();
      expect(result!.payment.status).toBe(PaymentStatus.SUCCEEDED);
    });

    it('ignora el webhook si el branchId de la URL no coincide con el del external_reference', async () => {
      mockApprovedPayment(`${orderId}:otro-branch`);
      mockSuccessfulProcessing();

      const result = await useCase.execute({ mpPaymentId: 99999, action: 'payment.updated', branchId });

      expect(result).toBeNull();
      expect(mockPaymentRepository.update).not.toHaveBeenCalled();
      expect(mockOrderRepository.update).not.toHaveBeenCalled();
    });

    it('ignora el webhook (sin llamar a MP) si el branch de la URL no existe', async () => {
      mockBranchRepository.findById.mockResolvedValue(null);

      const result = await useCase.execute({
        mpPaymentId: 99999,
        action: 'payment.updated',
        branchId: 'nonexistent-branch',
      });

      expect(result).toBeNull();
      expect(mockMercadoPagoService.getPayment).not.toHaveBeenCalled();
    });

    it('ignora el webhook si la organización no está ACTIVE', async () => {
      mockOrganizationRepository.findById.mockResolvedValue({ id: orgId, status: 'CANCELLED' } as any);

      const result = await useCase.execute({ mpPaymentId: 99999, action: 'payment.updated', branchId });

      expect(result).toBeNull();
      expect(mockMercadoPagoService.getPayment).not.toHaveBeenCalled();
    });
  });

  describe('multi-tenant: fallback sin branchId en la URL (preferencias pre-cambio)', () => {
    it('resuelve el tenant desde el external_reference y procesa', async () => {
      mockMercadoPagoService.getPayment.mockResolvedValue({
        id: 99999,
        status: 'approved',
        statusDetail: 'accredited',
        externalReference: `${orderId}:${branchId}`,
        transactionAmount: 150.50,
        currencyId: 'MXN',
        paymentMethodId: 'visa',
        paymentTypeId: 'credit_card',
        dateApproved: '2026-05-30T12:00:00.000Z',
        feeDetails: [],
      });
      mockPaymentRepository.findAll.mockResolvedValue([pendingPayment]);
      mockPaymentRepository.update.mockResolvedValue(
        new Payment(
          paymentId, orderId, userId, 150.50, 'MXN',
          PaymentStatus.SUCCEEDED, PaymentMethod.QR_MERCADO_PAGO,
          PaymentGateway.MERCADO_PAGO, '99999', null, new Date(), new Date()
        )
      );
      mockOrderRepository.findById.mockResolvedValue(mockOrder);
      mockOrderRepository.update.mockResolvedValue(
        new Order(
          orderId, new Date(), true, 4, 150.50, 129.74, 20.76,
          false, 'table-1', 0, 'Local', null, false, null, userId, null, null, null, null, null, null, null, null, null, new Date(), new Date()
        )
      );
      mockTableRepository.update.mockResolvedValue(
        new Table('table-1', 'Mesa 1', userId, true, true, new Date(), new Date())
      );

      const result = await useCase.execute({ mpPaymentId: 99999, action: 'payment.updated' });

      expect(mockBranchRepository.findById).toHaveBeenCalledWith(branchId);
      expect(result).not.toBeNull();
      expect(result!.payment.status).toBe(PaymentStatus.SUCCEEDED);
    });

    it('NUNCA procesa external_reference legacy sin branchId', async () => {
      mockMercadoPagoService.getPayment.mockResolvedValue({
        id: 99999,
        status: 'approved',
        statusDetail: 'accredited',
        externalReference: orderId, // formato legacy: solo orderId
        transactionAmount: 150.50,
        currencyId: 'MXN',
        paymentMethodId: 'visa',
        paymentTypeId: 'credit_card',
        dateApproved: '2026-05-30T12:00:00.000Z',
        feeDetails: [],
      });

      const result = await useCase.execute({ mpPaymentId: 99999, action: 'payment.updated' });

      expect(result).toBeNull();
      expect(mockPaymentRepository.findAll).not.toHaveBeenCalled();
      expect(mockPaymentRepository.update).not.toHaveBeenCalled();
    });

    it('ignora el webhook si el branch del external_reference no existe', async () => {
      mockMercadoPagoService.getPayment.mockResolvedValue({
        id: 99999,
        status: 'approved',
        statusDetail: 'accredited',
        externalReference: `${orderId}:nonexistent-branch`,
        transactionAmount: 150.50,
        currencyId: 'MXN',
        paymentMethodId: 'visa',
        paymentTypeId: 'credit_card',
        dateApproved: '2026-05-30T12:00:00.000Z',
        feeDetails: [],
      });
      mockBranchRepository.findById.mockResolvedValue(null);

      const result = await useCase.execute({ mpPaymentId: 99999, action: 'payment.updated' });

      expect(result).toBeNull();
      expect(mockPaymentRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('checkout diferido (Opción A): external_reference "checkout:<id>:<branch>"', () => {
    const checkoutId = 'checkout-abc';
    const newOrderId = 'order-materialized';
    const trackingToken = 'track-xyz';

    const mockCheckout: any = {
      id: checkoutId,
      branchId,
      status: 'WAITING',
      cart: [{ menuItemId: 'mi-1', quantity: 2 }],
      customerName: 'Ana',
      customerPhone: '5551112222',
      orderType: 'PICKUP',
      deliveryAddress: null,
      latitude: null,
      longitude: null,
      scheduledAt: null,
      total: 150.5,
      subtotal: 150.5,
      trackingToken,
      mpPreferenceId: 'pref-abc',
      paymentId,
      orderId: null,
      expiresAt: new Date(),
      createdAt: new Date(),
    };

    function mockCheckoutPayment(status: string) {
      mockMercadoPagoService.getPayment.mockResolvedValue({
        id: 99999,
        status,
        statusDetail: 'x',
        externalReference: `checkout:${checkoutId}:${branchId}`,
        transactionAmount: 150.5,
        currencyId: 'MXN',
        paymentMethodId: 'visa',
        paymentTypeId: 'credit_card',
        dateApproved: status === 'approved' ? '2026-07-19T12:00:00.000Z' : null,
        feeDetails: [],
      });
    }

    it('materializa la orden y confirma el pago cuando MP aprueba', async () => {
      mockCheckoutPayment('approved');
      mockPendingCheckoutRepository.findById.mockResolvedValue({ ...mockCheckout });
      mockPaymentRepository.findByGatewayTransactionId.mockResolvedValue(null);
      mockPaymentRepository.findById.mockResolvedValue(pendingPayment);
      // Tras materializar, processPayment relocaliza la fila Payment PENDING de la orden.
      mockPaymentRepository.findAll.mockResolvedValue([pendingPayment]);
      mockPersistence.persistOrder.mockResolvedValue({
        id: newOrderId, trackingToken, total: 150.5, subtotal: 150.5,
        origin: 'online-pickup', createdAt: new Date(),
      });

      // processPayment (tras materializar) busca la orden ya creada y la marca pagada.
      const materializedOrder = new Order(
        newOrderId, new Date(), false, null, 150.5, 150.5, 0,
        false, null, 0, 'online-pickup', null, false, null, null,
        'Ana', '5551112222', null, null, null, null, trackingToken, null, null, new Date(), new Date()
      );
      mockOrderRepository.findById.mockResolvedValue(materializedOrder);
      mockOrderRepository.update.mockResolvedValue(
        new Order(newOrderId, new Date(), true, 4, 150.5, 150.5, 0, false, null, 0,
          'online-pickup', null, false, null, null, 'Ana', '5551112222', null, null, null, null, trackingToken, 'PAID', null, new Date(), new Date())
      );
      mockPaymentRepository.update.mockResolvedValue(
        new Payment(paymentId, newOrderId, null, 150.5, 'MXN', PaymentStatus.SUCCEEDED,
          PaymentMethod.QR_MERCADO_PAGO, PaymentGateway.MERCADO_PAGO, '99999', null, new Date(), new Date())
      );

      const result = await useCase.execute({ mpPaymentId: 99999, action: 'payment.updated', branchId });

      expect(mockPersistence.persistOrder).toHaveBeenCalledTimes(1);
      expect(mockPendingCheckoutRepository.update).toHaveBeenCalledWith(checkoutId, {
        status: 'CONSUMED',
        orderId: newOrderId,
      });
      expect(mockPaymentRepository.update).toHaveBeenCalledWith(paymentId, { orderId: newOrderId });
      expect(result?.payment.status).toBe(PaymentStatus.SUCCEEDED);
    });

    it('NO materializa la orden cuando el pago es rechazado', async () => {
      mockCheckoutPayment('rejected');
      mockPendingCheckoutRepository.findById.mockResolvedValue({ ...mockCheckout });
      mockPaymentRepository.findByGatewayTransactionId.mockResolvedValue(null);
      mockPaymentRepository.findById.mockResolvedValue(pendingPayment);
      mockPaymentRepository.update.mockResolvedValue(
        new Payment(paymentId, null, null, 150.5, 'MXN', PaymentStatus.FAILED,
          PaymentMethod.QR_MERCADO_PAGO, PaymentGateway.MERCADO_PAGO, '99999', null, new Date(), new Date())
      );

      const result = await useCase.execute({ mpPaymentId: 99999, action: 'payment.updated', branchId });

      expect(mockPersistence.persistOrder).not.toHaveBeenCalled();
      expect(mockOrderRepository.update).not.toHaveBeenCalled();
      expect(result?.payment.status).toBe(PaymentStatus.FAILED);
    });

    it('es idempotente: si el checkout ya fue consumido, reusa la orden y no la crea de nuevo', async () => {
      mockCheckoutPayment('approved');
      mockPendingCheckoutRepository.findById.mockResolvedValue({
        ...mockCheckout, status: 'CONSUMED', orderId: newOrderId,
      });
      mockPaymentRepository.findByGatewayTransactionId.mockResolvedValue(null);
      mockPaymentRepository.findById.mockResolvedValue(pendingPayment);
      // Tras reusar la orden ya materializada, processPayment relocaliza la fila Payment PENDING.
      mockPaymentRepository.findAll.mockResolvedValue([pendingPayment]);

      const materializedOrder = new Order(
        newOrderId, new Date(), false, null, 150.5, 150.5, 0,
        false, null, 0, 'online-pickup', null, false, null, null,
        'Ana', '5551112222', null, null, null, null, trackingToken, null, null, new Date(), new Date()
      );
      mockOrderRepository.findById.mockResolvedValue(materializedOrder);
      mockOrderRepository.update.mockResolvedValue(materializedOrder);
      mockPaymentRepository.update.mockResolvedValue(
        new Payment(paymentId, newOrderId, null, 150.5, 'MXN', PaymentStatus.SUCCEEDED,
          PaymentMethod.QR_MERCADO_PAGO, PaymentGateway.MERCADO_PAGO, '99999', null, new Date(), new Date())
      );

      await useCase.execute({ mpPaymentId: 99999, action: 'payment.updated', branchId });

      expect(mockPersistence.persistOrder).not.toHaveBeenCalled();
    });

    it('ignora el webhook si el checkout no existe', async () => {
      mockCheckoutPayment('approved');
      mockPendingCheckoutRepository.findById.mockResolvedValue(null);

      const result = await useCase.execute({ mpPaymentId: 99999, action: 'payment.updated', branchId });

      expect(result).toBeNull();
      expect(mockPersistence.persistOrder).not.toHaveBeenCalled();
    });
  });
});
