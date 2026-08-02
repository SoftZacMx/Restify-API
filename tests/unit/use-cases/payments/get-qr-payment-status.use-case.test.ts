import { GetQRPaymentStatusUseCase } from '../../../../src/core/application/use-cases/payments/get-qr-payment-status.use-case';
import { IPaymentRepository } from '../../../../src/core/domain/interfaces/payment-repository.interface';
import { MercadoPagoService } from '../../../../src/core/infrastructure/payment-gateways/mercado-pago.service';
import { Payment } from '../../../../src/core/domain/entities/payment.entity';
import { PaymentStatus, PaymentMethod, PaymentGateway } from '@prisma/client';

describe('GetQRPaymentStatusUseCase', () => {
  let useCase: GetQRPaymentStatusUseCase;
  let mockPaymentRepository: jest.Mocked<IPaymentRepository>;
  let mockMercadoPagoService: jest.Mocked<MercadoPagoService>;

  const orderId = 'order-123';
  const paymentId = 'payment-123';

  function buildPayment(status: PaymentStatus, gatewayTransactionId: string | null = 'tx-123'): Payment {
    return new Payment(
      paymentId, orderId, null, 150.50, 'MXN',
      status, PaymentMethod.QR_MERCADO_PAGO,
      PaymentGateway.MERCADO_PAGO, gatewayTransactionId, null, new Date(), new Date()
    );
  }

  beforeEach(() => {
    mockPaymentRepository = {
      findById: jest.fn(),
      findByGatewayTransactionId: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    mockMercadoPagoService = {
      createPreference: jest.fn(),
      getPreference: jest.fn(),
      getPayment: jest.fn(),
      cancelPayment: jest.fn(),
      validateWebhookSignature: jest.fn(),
    } as any;

    useCase = new GetQRPaymentStatusUseCase(mockPaymentRepository, mockMercadoPagoService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('ejecución', () => {
    it('lanza PAYMENT_NOT_FOUND cuando no hay pago de Mercado Pago para la orden', async () => {
      mockPaymentRepository.findAll.mockResolvedValue([]);

      await expect(useCase.execute({ orderId })).rejects.toMatchObject({
        code: 'PAYMENT_NOT_FOUND',
      });
      expect(mockMercadoPagoService.getPayment).not.toHaveBeenCalled();
    });

    it('ignora pagos de otro gateway y lanza PAYMENT_NOT_FOUND', async () => {
      const stripePayment = new Payment(
        paymentId, orderId, null, 150.50, 'MXN',
        PaymentStatus.PENDING, PaymentMethod.CARD_STRIPE,
        PaymentGateway.STRIPE, 'pi_123', null, new Date(), new Date()
      );
      mockPaymentRepository.findAll.mockResolvedValue([stripePayment]);

      await expect(useCase.execute({ orderId })).rejects.toMatchObject({
        code: 'PAYMENT_NOT_FOUND',
      });
    });

    it('retorna el estado local sin consultar MP cuando el pago ya terminó (SUCCEEDED)', async () => {
      mockPaymentRepository.findAll.mockResolvedValue([buildPayment(PaymentStatus.SUCCEEDED)]);

      const result = await useCase.execute({ orderId });

      expect(mockMercadoPagoService.getPayment).not.toHaveBeenCalled();
      expect(result).toEqual({
        paymentId,
        status: PaymentStatus.SUCCEEDED,
        gatewayTransactionId: 'tx-123',
      });
    });

    it('consulta MP cuando está PENDING y actualiza a SUCCEEDED si MP reporta approved', async () => {
      mockPaymentRepository.findAll.mockResolvedValue([buildPayment(PaymentStatus.PENDING)]);
      mockMercadoPagoService.getPayment.mockResolvedValue({
        id: 99999, status: 'approved', statusDetail: 'accredited',
        externalReference: orderId, transactionAmount: 150.50, currencyId: 'MXN',
        paymentMethodId: 'visa', paymentTypeId: 'credit_card', dateApproved: '2026-03-27T12:00:00.000Z',
        feeDetails: [],
      });
      mockPaymentRepository.update.mockResolvedValue(buildPayment(PaymentStatus.SUCCEEDED));

      const result = await useCase.execute({ orderId });

      expect(mockMercadoPagoService.getPayment).toHaveBeenCalledWith('tx-123');
      expect(mockPaymentRepository.update).toHaveBeenCalledWith(paymentId, {
        status: PaymentStatus.SUCCEEDED,
      });
      expect(result.status).toBe(PaymentStatus.SUCCEEDED);
    });

    it('NO aprueba cuando el monto pagado no coincide con el esperado: queda PROCESSING', async () => {
      mockPaymentRepository.findAll.mockResolvedValue([buildPayment(PaymentStatus.PENDING)]);
      mockMercadoPagoService.getPayment.mockResolvedValue({
        id: 99999, status: 'approved', statusDetail: 'accredited',
        externalReference: orderId, transactionAmount: 10.0, currencyId: 'MXN',
        paymentMethodId: 'visa', paymentTypeId: 'credit_card', dateApproved: '2026-03-27T12:00:00.000Z',
        feeDetails: [],
      });
      mockPaymentRepository.update.mockResolvedValue(buildPayment(PaymentStatus.PROCESSING));

      const result = await useCase.execute({ orderId });

      expect(mockPaymentRepository.update).toHaveBeenCalledWith(paymentId, {
        status: PaymentStatus.PROCESSING,
      });
      expect(mockPaymentRepository.update).not.toHaveBeenCalledWith(paymentId, {
        status: PaymentStatus.SUCCEEDED,
      });
      expect(result.status).toBe(PaymentStatus.PROCESSING);
    });

    it('mantiene el estado local cuando MP no reporta approved (pending → PROCESSING no aplica)', async () => {
      mockPaymentRepository.findAll.mockResolvedValue([buildPayment(PaymentStatus.PENDING)]);
      mockMercadoPagoService.getPayment.mockResolvedValue({
        id: 99999, status: 'pending', statusDetail: 'pending_waiting_transfer',
        externalReference: orderId, transactionAmount: 150.50, currencyId: 'MXN',
        paymentMethodId: 'bank_transfer', paymentTypeId: 'bank_transfer', dateApproved: null,
        feeDetails: [],
      });

      const result = await useCase.execute({ orderId });

      expect(mockPaymentRepository.update).not.toHaveBeenCalled();
      expect(result.status).toBe(PaymentStatus.PENDING);
    });

    it('retorna el estado local cuando la consulta a MP falla', async () => {
      mockPaymentRepository.findAll.mockResolvedValue([buildPayment(PaymentStatus.PROCESSING)]);
      mockMercadoPagoService.getPayment.mockRejectedValue(new Error('MP down'));

      const result = await useCase.execute({ orderId });

      expect(mockPaymentRepository.update).not.toHaveBeenCalled();
      expect(result.status).toBe(PaymentStatus.PROCESSING);
    });

    it('no consulta MP si el pago PENDING no tiene gatewayTransactionId', async () => {
      mockPaymentRepository.findAll.mockResolvedValue([buildPayment(PaymentStatus.PENDING, null)]);

      const result = await useCase.execute({ orderId });

      expect(mockMercadoPagoService.getPayment).not.toHaveBeenCalled();
      expect(result.status).toBe(PaymentStatus.PENDING);
      expect(result.gatewayTransactionId).toBeNull();
    });
  });
});
