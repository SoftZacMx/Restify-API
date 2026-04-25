import { MercadoPagoService } from '../../../src/core/infrastructure/payment-gateways/mercado-pago.service';
import { PaymentConfigService } from '../../../src/core/application/services/payment-config.service';

// Mock mercadopago SDK
const mockPreferenceCreate = jest.fn();
const mockPreferenceGet = jest.fn();
const mockPaymentGet = jest.fn();

jest.mock('mercadopago', () => ({
  MercadoPagoConfig: jest.fn().mockImplementation(() => ({})),
  Preference: jest.fn().mockImplementation(() => ({
    create: mockPreferenceCreate,
    get: mockPreferenceGet,
  })),
  Payment: jest.fn().mockImplementation(() => ({
    get: mockPaymentGet,
  })),
}));

const mockPaymentConfig = {
  mercadoPago: {
    accessToken: 'TEST-token-123',
    webhookSecret: 'webhook-secret-123',
  },
};

describe('MercadoPagoService', () => {
  let service: MercadoPagoService;
  let mockPaymentConfigService: jest.Mocked<PaymentConfigService>;

  beforeEach(() => {
    process.env.MP_BACK_URL = 'https://restify.app';
    jest.clearAllMocks();
    mockPaymentConfigService = {
      get: jest.fn().mockResolvedValue(mockPaymentConfig),
      save: jest.fn(),
      clearCache: jest.fn(),
    } as any;
    service = new MercadoPagoService(mockPaymentConfigService);
  });

  describe('createPreference', () => {
    it('should create a preference and return mapped result', async () => {
      mockPreferenceCreate.mockResolvedValue({
        id: 'pref-123',
        init_point: 'https://www.mercadopago.com.mx/checkout/v1/redirect?pref_id=pref-123',
        sandbox_init_point: 'https://sandbox.mercadopago.com.mx/checkout/v1/redirect?pref_id=pref-123',
        expiration_date_to: '2026-03-27T12:00:00.000Z',
      });

      const result = await service.createPreference({
        orderId: 'order-123',
        title: 'Orden #order-12 - Restify',
        description: 'Pago de orden',
        amount: 150.50,
        currency: 'MXN',
        metadata: { orderId: 'order-123', paymentId: 'pay-123' },
        notificationUrl: 'https://api.restify.com/webhooks/mercado-pago',
        expirationDate: '2026-03-27T12:00:00.000Z',
      });

      expect(result).toEqual({
        id: 'pref-123',
        initPoint: 'https://www.mercadopago.com.mx/checkout/v1/redirect?pref_id=pref-123',
        sandboxInitPoint: 'https://sandbox.mercadopago.com.mx/checkout/v1/redirect?pref_id=pref-123',
        expirationDate: '2026-03-27T12:00:00.000Z',
      });

      expect(mockPreferenceCreate).toHaveBeenCalledWith({
        body: expect.objectContaining({
          items: [expect.objectContaining({
            id: 'order-123',
            title: 'Orden #order-12 - Restify',
            unit_price: 150.50,
            currency_id: 'MXN',
            quantity: 1,
          })],
          external_reference: 'order-123',
          notification_url: 'https://api.restify.com/webhooks/mercado-pago',
          back_urls: {
            success: 'https://restify.app/payment/success',
            failure: 'https://restify.app/payment/failure?status=failure',
            pending: 'https://restify.app/payment/pending?status=pending',
          },
          expires: true,
          payment_methods: expect.objectContaining({
            excluded_payment_types: [{ id: 'ticket' }],
            installments: 1,
          }),
        }),
      });
    });
  });

  describe('getPreference', () => {
    it('should get a preference by ID', async () => {
      mockPreferenceGet.mockResolvedValue({
        id: 'pref-123',
        init_point: 'https://mp.com/checkout',
        sandbox_init_point: 'https://sandbox.mp.com/checkout',
        expiration_date_to: null,
      });

      const result = await service.getPreference('pref-123');

      expect(result.id).toBe('pref-123');
      expect(result.initPoint).toBe('https://mp.com/checkout');
      expect(result.expirationDate).toBeNull();
      expect(mockPreferenceGet).toHaveBeenCalledWith({ preferenceId: 'pref-123' });
    });
  });

  describe('getPayment', () => {
    it('should get a payment by ID and return mapped result', async () => {
      mockPaymentGet.mockResolvedValue({
        id: 12345,
        status: 'approved',
        status_detail: 'accredited',
        external_reference: 'order-123',
        transaction_amount: 150.50,
        currency_id: 'MXN',
        payment_method_id: 'visa',
        payment_type_id: 'credit_card',
        date_approved: '2026-03-27T12:00:00.000Z',
      });

      const result = await service.getPayment('12345');

      expect(result).toEqual({
        id: 12345,
        status: 'approved',
        statusDetail: 'accredited',
        externalReference: 'order-123',
        transactionAmount: 150.50,
        currencyId: 'MXN',
        paymentMethodId: 'visa',
        paymentTypeId: 'credit_card',
        dateApproved: '2026-03-27T12:00:00.000Z',
        feeDetails: [],
      });
      expect(mockPaymentGet).toHaveBeenCalledWith({ id: '12345' });
    });

    it('should return null dateApproved when payment is not approved', async () => {
      mockPaymentGet.mockResolvedValue({
        id: 12345,
        status: 'pending',
        status_detail: 'pending_waiting_transfer',
        external_reference: 'order-123',
        transaction_amount: 100,
        currency_id: 'MXN',
        payment_method_id: 'bank_transfer',
        payment_type_id: 'bank_transfer',
        date_approved: null,
      });

      const result = await service.getPayment('12345');
      expect(result.dateApproved).toBeNull();
    });

    it('should map fee_details from MP API response, filtering out zero/negative amounts', async () => {
      mockPaymentGet.mockResolvedValue({
        id: 12345,
        status: 'approved',
        status_detail: 'accredited',
        external_reference: 'order-123',
        transaction_amount: 150.50,
        currency_id: 'MXN',
        payment_method_id: 'visa',
        payment_type_id: 'credit_card',
        date_approved: '2026-04-24T12:00:00.000Z',
        fee_details: [
          { type: 'mercadopago_fee', amount: 5.25, fee_payer: 'collector' },
          { type: 'financing_fee', amount: 0, fee_payer: 'collector' }, // se filtra
          { type: 'shipping_fee', amount: 1.10, fee_payer: 'collector' },
        ],
      });

      const result = await service.getPayment('12345');

      expect(result.feeDetails).toEqual([
        { type: 'mercadopago_fee', amount: 5.25, feePayer: 'collector' },
        { type: 'shipping_fee', amount: 1.10, feePayer: 'collector' },
      ]);
    });
  });

  describe('validateWebhookSignature', () => {
    it('should return true for a valid signature', async () => {
      const crypto = require('crypto');
      const secret = 'webhook-secret-123';
      const dataId = '12345';
      const xRequestId = 'req-abc';
      const ts = '1234567890';

      const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
      const expectedHmac = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

      const result = await service.validateWebhookSignature({
        xSignature: `ts=${ts},v1=${expectedHmac}`,
        xRequestId,
        dataId,
      });

      expect(result).toBe(true);
    });

    it('should return false for an invalid signature', async () => {
      const result = await service.validateWebhookSignature({
        xSignature: 'ts=123,v1=invalidsignature',
        xRequestId: 'req-abc',
        dataId: '12345',
      });

      expect(result).toBe(false);
    });

    it('should return false when x-signature format is invalid', async () => {
      const result = await service.validateWebhookSignature({
        xSignature: 'malformed-header',
        xRequestId: 'req-abc',
        dataId: '12345',
      });

      expect(result).toBe(false);
    });

    it('should throw error if webhook secret is not configured', async () => {
      mockPaymentConfigService.get.mockResolvedValue({
        mercadoPago: { ...mockPaymentConfig.mercadoPago, webhookSecret: '' },
      });

      await expect(service.validateWebhookSignature({
        xSignature: 'ts=123,v1=abc',
        xRequestId: 'req-abc',
        dataId: '12345',
      })).rejects.toThrow('Mercado Pago webhook secret no configurado');
    });
  });
});
