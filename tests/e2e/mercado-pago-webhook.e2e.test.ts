/// <reference types="jest" />

// Mock @middy modules before importing handlers
jest.mock('@middy/core', () => {
  return {
    __esModule: true,
    default: (handler: any) => {
      const middlewares: any[] = [];

      const wrappedHandler = async (event: any, context: any) => {
        const request: any = { event, context, response: null, error: null };

        try {
          for (const middleware of middlewares) {
            if (middleware.before) {
              await middleware.before(request);
            }
          }

          const result = await handler(request.event, request.context);
          request.response = result;

          for (const middleware of middlewares) {
            if (middleware.after) {
              await middleware.after(request);
            }
          }

          return request.response || result;
        } catch (error) {
          request.error = error;

          for (const middleware of middlewares) {
            if (middleware.onError) {
              await middleware.onError(request);
            }
          }

          if (request.response) {
            return request.response;
          }
          throw error;
        }
      };

      wrappedHandler.use = (middleware: any) => {
        middlewares.push(middleware);
        return wrappedHandler;
      };

      return wrappedHandler;
    },
  };
});

jest.mock('@middy/http-json-body-parser', () => ({
  __esModule: true,
  default: () => ({
    before: async (request: any) => {
      if (request.event.body && typeof request.event.body === 'string') {
        try {
          request.event.body = JSON.parse(request.event.body);
        } catch {
          // Keep as string if not valid JSON
        }
      }
    },
  }),
}));

jest.mock('@middy/http-event-normalizer', () => ({
  __esModule: true,
  default: () => ({
    before: async (request: any) => {
      request.event.pathParameters = request.event.pathParameters || {};
      request.event.queryStringParameters = request.event.queryStringParameters || {};
    },
  }),
}));

jest.mock('../../src/shared/middleware/zod-validator.middleware', () => {
  const { AppError } = require('../../src/shared/errors');
  const { ZodError } = require('zod');

  return {
    zodValidator: (options: any) => ({
      before: async (request: any) => {
        const { schema, eventKey } = options;
        let data = request.event[eventKey];

        if (eventKey === 'queryStringParameters' && data === null) {
          data = {};
        }

        if (eventKey === 'body' && typeof data === 'string') {
          try {
            data = JSON.parse(data);
          } catch {
            // Keep as string if not valid JSON
          }
        }

        if (data !== undefined && data !== null) {
          try {
            const validated = schema.parse(data);
            request.event[eventKey] = validated;
          } catch (error: any) {
            if (error instanceof ZodError) {
              const errorMessage = error.errors
                .map((e: any) => `${e.path.join('.')}: ${e.message}`)
                .join(', ');
              throw new AppError('VALIDATION_ERROR', errorMessage);
            }
            throw error;
          }
        }
      },
    }),
  };
});

jest.mock('../../src/shared/middleware/error-handler.middleware', () => {
  const { AppError } = require('../../src/shared/errors');
  const { ApiResponseHandler } = require('../../src/shared/types/lambda.types');
  const { ZodError } = require('zod');

  return {
    customErrorHandler: () => ({
      onError: async (request: any) => {
        const error = request.error;
        if (error) {
          let appError;

          if (error instanceof AppError) {
            appError = error;
          } else if (error instanceof ZodError) {
            const errorMessage = error.errors
              .map((e: any) => `${e.path.join('.')}: ${e.message}`)
              .join(', ');
            appError = new AppError('VALIDATION_ERROR', errorMessage);
          } else {
            appError = new AppError('INTERNAL_ERROR', error.message || 'An unexpected error occurred');
          }

          request.response = ApiResponseHandler.error(appError, appError.statusCode);
        }
      },
    }),
  };
});

jest.mock('../../src/shared/middleware/response-formatter.middleware', () => ({
  responseFormatter: () => ({
    after: async (request: any) => {
      const { ApiResponseHandler } = require('../../src/shared/types/lambda.types');
      if (request.response && !(request.response.statusCode)) {
        request.response = ApiResponseHandler.success(request.response, 200);
      }
    },
  }),
}));

// Mock MercadoPagoService to avoid real API calls
const mockGetPayment = jest.fn();

jest.mock('../../src/core/infrastructure/payment-gateways/mercado-pago.service', () => {
  return {
    MercadoPagoService: jest.fn().mockImplementation(() => ({
      getPayment: mockGetPayment,
      createPreference: jest.fn(),
      getPreference: jest.fn(),
      validateWebhookSignature: jest.fn().mockReturnValue(true),
    })),
  };
});

// Mock SQS to avoid real queue calls
jest.mock('../../src/core/infrastructure/queue/sqs.service', () => {
  return {
    SQSService: jest.fn().mockImplementation(() => ({
      sendPaymentNotification: jest.fn().mockResolvedValue(undefined),
      sendOrderNotification: jest.fn().mockResolvedValue(undefined),
    })),
  };
});

// Initialize dependency injection after mocks
import '../../src/core/infrastructure/config/dependency-injection';

import { container } from 'tsyringe';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { PaymentStatus, PaymentMethod, PaymentGateway } from '@prisma/client';
import { mercadoPagoWebhookHandler } from '../../src/handlers/payments/mercado-pago-webhook.handler';
import { IPaymentRepository } from '../../src/core/domain/interfaces/payment-repository.interface';
import { IOrderRepository } from '../../src/core/domain/interfaces/order-repository.interface';
import { ITableRepository } from '../../src/core/domain/interfaces/table-repository.interface';
import { Payment } from '../../src/core/domain/entities/payment.entity';
import { Order } from '../../src/core/domain/entities/order.entity';
import { Table } from '../../src/core/domain/entities/table.entity';

const mockContext: Context = {
  callbackWaitsForEmptyEventLoop: false,
  functionName: 'test-function',
  functionVersion: '1',
  invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test',
  memoryLimitInMB: '128',
  awsRequestId: 'test-request-id',
  logGroupName: '/aws/lambda/test',
  logStreamName: '2024/01/01/[$LATEST]test',
  getRemainingTimeInMillis: () => 30000,
  done: () => {},
  fail: () => {},
  succeed: () => {},
};

const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});

describe('Mercado Pago Webhook E2E Tests', () => {
  const orderId = 'e2e-order-mp-001';
  const userId = 'e2e-user-mp-001';
  const paymentId = 'e2e-payment-mp-001';
  const tableId = 'e2e-table-mp-001';

  let mockPaymentRepo: jest.Mocked<IPaymentRepository>;
  let mockOrderRepo: jest.Mocked<IOrderRepository>;
  let mockTableRepo: jest.Mocked<ITableRepository>;

  const pendingPayment = new Payment(
    paymentId, orderId, userId, 150.00, 'MXN',
    PaymentStatus.PENDING, PaymentMethod.QR_MERCADO_PAGO,
    PaymentGateway.MERCADO_PAGO, 'pref-e2e', null, new Date(), new Date()
  );

  const unpaidOrder = new Order(
    orderId, new Date(), false, null, 150.00, 129.31, 20.69,
    false, tableId, 0, 'Local', null, false, null, userId, null, null, null, null, null, null, null, new Date(), new Date()
  );

  const paidOrder = new Order(
    orderId, new Date(), true, 4, 150.00, 129.31, 20.69,
    true, tableId, 0, 'Local', null, false, null, userId, null, null, null, null, null, null, null, new Date(), new Date()
  );

  const mockTable = new Table(tableId, 'Mesa 1', userId, true, true, new Date(), new Date());

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock repositories
    mockPaymentRepo = {
      findById: jest.fn(),
      findByGatewayTransactionId: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    mockOrderRepo = {
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

    mockTableRepo = {
      findById: jest.fn(),
      findByName: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    // Register mocked repos in DI container
    container.register('IPaymentRepository', { useValue: mockPaymentRepo });
    container.register('IOrderRepository', { useValue: mockOrderRepo });
    container.register('ITableRepository', { useValue: mockTableRepo });
  });

  function buildWebhookEvent(mpPaymentId: number, type = 'payment'): Partial<APIGatewayProxyEvent> {
    return {
      httpMethod: 'POST',
      path: '/webhooks/mercado-pago',
      body: JSON.stringify({
        type,
        action: 'payment.updated',
        data: { id: mpPaymentId },
      }),
      headers: {
        'Content-Type': 'application/json',
        'x-signature': 'ts=123,v1=fakesig',
        'x-request-id': 'req-e2e-test',
      },
      queryStringParameters: { 'data.id': String(mpPaymentId) },
    };
  }

  describe('3.1 - Webhook approved → order completed', () => {
    it('should update payment to SUCCEEDED, order to paid/delivered with paymentMethod 4, and release table', async () => {
      mockGetPayment.mockResolvedValue({
        id: 77777,
        status: 'approved',
        statusDetail: 'accredited',
        externalReference: orderId,
        transactionAmount: 150.00,
        currencyId: 'MXN',
        paymentMethodId: 'visa',
        paymentTypeId: 'credit_card',
        dateApproved: new Date().toISOString(),
      });

      mockPaymentRepo.findAll.mockResolvedValue([pendingPayment]);

      const succeededPayment = new Payment(
        paymentId, orderId, userId, 150.00, 'MXN',
        PaymentStatus.SUCCEEDED, PaymentMethod.QR_MERCADO_PAGO,
        PaymentGateway.MERCADO_PAGO, '77777', null, new Date(), new Date()
      );
      mockPaymentRepo.update.mockResolvedValue(succeededPayment);
      mockOrderRepo.findById.mockResolvedValue(unpaidOrder);
      mockOrderRepo.update.mockResolvedValue(paidOrder);
      mockTableRepo.update.mockResolvedValue(mockTable);

      const response = await mercadoPagoWebhookHandler(
        buildWebhookEvent(77777) as any,
        mockContext
      );

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.received).toBe(true);

      // Payment updated to SUCCEEDED
      expect(mockPaymentRepo.update).toHaveBeenCalledWith(paymentId, {
        status: PaymentStatus.SUCCEEDED,
        gatewayTransactionId: '77777',
      });

      // Order updated: paid, paymentMethod 4, delivered
      expect(mockOrderRepo.update).toHaveBeenCalledWith(orderId, {
        status: true,
        paymentMethod: 4,
        delivered: true,
      });

      // Table released
      expect(mockTableRepo.update).toHaveBeenCalledWith(tableId, {
        availabilityStatus: true,
      });
    });
  });

  describe('3.2 - Webhook rejected → payment failed, order unchanged', () => {
    it('should update payment to FAILED and not touch the order', async () => {
      mockGetPayment.mockResolvedValue({
        id: 88888,
        status: 'rejected',
        statusDetail: 'cc_rejected_other_reason',
        externalReference: orderId,
        transactionAmount: 150.00,
        currencyId: 'MXN',
        paymentMethodId: 'visa',
        paymentTypeId: 'credit_card',
        dateApproved: null,
      });

      mockPaymentRepo.findAll.mockResolvedValue([pendingPayment]);

      const failedPayment = new Payment(
        paymentId, orderId, userId, 150.00, 'MXN',
        PaymentStatus.FAILED, PaymentMethod.QR_MERCADO_PAGO,
        PaymentGateway.MERCADO_PAGO, '88888', null, new Date(), new Date()
      );
      mockPaymentRepo.update.mockResolvedValue(failedPayment);

      const response = await mercadoPagoWebhookHandler(
        buildWebhookEvent(88888) as any,
        mockContext
      );

      expect(response.statusCode).toBe(200);

      expect(mockPaymentRepo.update).toHaveBeenCalledWith(paymentId, {
        status: PaymentStatus.FAILED,
        gatewayTransactionId: '88888',
      });

      // Order should NOT be updated
      expect(mockOrderRepo.update).not.toHaveBeenCalled();
      expect(mockTableRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('3.3 - Webhook cancelled → payment canceled, order unchanged', () => {
    it('should update payment to CANCELED and not touch the order', async () => {
      mockGetPayment.mockResolvedValue({
        id: 66666,
        status: 'cancelled',
        statusDetail: 'expired',
        externalReference: orderId,
        transactionAmount: 150.00,
        currencyId: 'MXN',
        paymentMethodId: 'visa',
        paymentTypeId: 'credit_card',
        dateApproved: null,
      });

      mockPaymentRepo.findAll.mockResolvedValue([pendingPayment]);

      const canceledPayment = new Payment(
        paymentId, orderId, userId, 150.00, 'MXN',
        PaymentStatus.CANCELED, PaymentMethod.QR_MERCADO_PAGO,
        PaymentGateway.MERCADO_PAGO, '66666', null, new Date(), new Date()
      );
      mockPaymentRepo.update.mockResolvedValue(canceledPayment);

      const response = await mercadoPagoWebhookHandler(
        buildWebhookEvent(66666) as any,
        mockContext
      );

      expect(response.statusCode).toBe(200);

      expect(mockPaymentRepo.update).toHaveBeenCalledWith(paymentId, {
        status: PaymentStatus.CANCELED,
        gatewayTransactionId: '66666',
      });

      expect(mockOrderRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('3.4 - Webhook pending → payment processing, order unchanged', () => {
    it('should update payment to PROCESSING and not touch the order', async () => {
      mockGetPayment.mockResolvedValue({
        id: 55555,
        status: 'pending',
        statusDetail: 'pending_waiting_transfer',
        externalReference: orderId,
        transactionAmount: 150.00,
        currencyId: 'MXN',
        paymentMethodId: 'bank_transfer',
        paymentTypeId: 'bank_transfer',
        dateApproved: null,
      });

      mockPaymentRepo.findAll.mockResolvedValue([pendingPayment]);

      const processingPayment = new Payment(
        paymentId, orderId, userId, 150.00, 'MXN',
        PaymentStatus.PROCESSING, PaymentMethod.QR_MERCADO_PAGO,
        PaymentGateway.MERCADO_PAGO, '55555', null, new Date(), new Date()
      );
      mockPaymentRepo.update.mockResolvedValue(processingPayment);

      const response = await mercadoPagoWebhookHandler(
        buildWebhookEvent(55555) as any,
        mockContext
      );

      expect(response.statusCode).toBe(200);

      expect(mockPaymentRepo.update).toHaveBeenCalledWith(paymentId, {
        status: PaymentStatus.PROCESSING,
        gatewayTransactionId: '55555',
      });

      expect(mockOrderRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('3.5 - Webhook idempotency → duplicate ignored', () => {
    it('should return 200 and not modify anything when no pending payment exists', async () => {
      mockGetPayment.mockResolvedValue({
        id: 77777,
        status: 'approved',
        statusDetail: 'accredited',
        externalReference: orderId,
        transactionAmount: 150.00,
        currencyId: 'MXN',
        paymentMethodId: 'visa',
        paymentTypeId: 'credit_card',
        dateApproved: new Date().toISOString(),
      });

      // No pending payments found (already processed)
      mockPaymentRepo.findAll.mockResolvedValue([]);

      const response = await mercadoPagoWebhookHandler(
        buildWebhookEvent(77777) as any,
        mockContext
      );

      expect(response.statusCode).toBe(200);

      expect(mockPaymentRepo.update).not.toHaveBeenCalled();
      expect(mockOrderRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('3.6 - Webhook without external_reference → ignored', () => {
    it('should return 200 and not process when external_reference is empty', async () => {
      mockGetPayment.mockResolvedValue({
        id: 44444,
        status: 'approved',
        statusDetail: 'accredited',
        externalReference: '',
        transactionAmount: 150.00,
        currencyId: 'MXN',
        paymentMethodId: 'visa',
        paymentTypeId: 'credit_card',
        dateApproved: new Date().toISOString(),
      });

      const response = await mercadoPagoWebhookHandler(
        buildWebhookEvent(44444) as any,
        mockContext
      );

      expect(response.statusCode).toBe(200);

      expect(mockPaymentRepo.findAll).not.toHaveBeenCalled();
      expect(mockPaymentRepo.update).not.toHaveBeenCalled();
      expect(mockOrderRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('3.7 - Webhook with unknown status → ignored', () => {
    it('should return 200 and not modify anything for unknown MP status', async () => {
      mockGetPayment.mockResolvedValue({
        id: 33333,
        status: 'some_unknown_status',
        statusDetail: 'unknown',
        externalReference: orderId,
        transactionAmount: 150.00,
        currencyId: 'MXN',
        paymentMethodId: 'visa',
        paymentTypeId: 'credit_card',
        dateApproved: null,
      });

      mockPaymentRepo.findAll.mockResolvedValue([pendingPayment]);

      const response = await mercadoPagoWebhookHandler(
        buildWebhookEvent(33333) as any,
        mockContext
      );

      expect(response.statusCode).toBe(200);

      expect(mockPaymentRepo.update).not.toHaveBeenCalled();
      expect(mockOrderRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('Non-payment event → ignored', () => {
    it('should return 200 without processing non-payment events', async () => {
      const response = await mercadoPagoWebhookHandler(
        buildWebhookEvent(12345, 'merchant_order') as any,
        mockContext
      );

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.received).toBe(true);

      expect(mockGetPayment).not.toHaveBeenCalled();
    });
  });

  describe('4.3 - Delivery order → no table released', () => {
    it('should not release table for delivery orders', async () => {
      const deliveryOrder = new Order(
        orderId, new Date(), false, null, 150.00, 129.31, 20.69,
        false, null, 0, 'Delivery', null, false, null, userId, new Date(), new Date()
      );

      mockGetPayment.mockResolvedValue({
        id: 77777,
        status: 'approved',
        statusDetail: 'accredited',
        externalReference: orderId,
        transactionAmount: 150.00,
        currencyId: 'MXN',
        paymentMethodId: 'visa',
        paymentTypeId: 'credit_card',
        dateApproved: new Date().toISOString(),
      });

      mockPaymentRepo.findAll.mockResolvedValue([pendingPayment]);

      const succeededPayment = new Payment(
        paymentId, orderId, userId, 150.00, 'MXN',
        PaymentStatus.SUCCEEDED, PaymentMethod.QR_MERCADO_PAGO,
        PaymentGateway.MERCADO_PAGO, '77777', null, new Date(), new Date()
      );
      mockPaymentRepo.update.mockResolvedValue(succeededPayment);
      mockOrderRepo.findById.mockResolvedValue(deliveryOrder);

      const paidDeliveryOrder = new Order(
        orderId, new Date(), true, 4, 150.00, 129.31, 20.69,
        true, null, 0, 'Delivery', null, false, null, userId, new Date(), new Date()
      );
      mockOrderRepo.update.mockResolvedValue(paidDeliveryOrder);

      const response = await mercadoPagoWebhookHandler(
        buildWebhookEvent(77777) as any,
        mockContext
      );

      expect(response.statusCode).toBe(200);

      // Order updated but table NOT released
      expect(mockOrderRepo.update).toHaveBeenCalled();
      expect(mockTableRepo.update).not.toHaveBeenCalled();
    });
  });
});
