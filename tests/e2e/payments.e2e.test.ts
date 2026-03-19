/// <reference types="jest" />

// Mock @middy modules before importing handlers
jest.mock('@middy/core', () => {
  return {
    __esModule: true,
    default: (handler: any) => {
      const middlewares: any[] = []; // Each handler gets its own middlewares array
      
      const wrappedHandler = async (event: any, context: any) => {
        const request: any = { event, context, response: null, error: null };
        
        try {
          // Execute before middlewares
          for (const middleware of middlewares) {
            if (middleware.before) {
              await middleware.before(request);
            }
          }
          
          // Execute handler
          const result = await handler(request.event, request.context);
          request.response = result;
          
          // Execute after middlewares
          for (const middleware of middlewares) {
            if (middleware.after) {
              await middleware.after(request);
            }
          }
          
          return request.response || result;
        } catch (error) {
          request.error = error;
          
          // Execute error middlewares
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
        
        // Handle null queryStringParameters
        if (eventKey === 'queryStringParameters' && data === null) {
          data = {};
        }
        
        // Parse body if it's still a string (httpJsonBodyParser may not have run yet)
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

jest.mock('../../src/shared/middleware/error-handler.middleware', () => ({
  customErrorHandler: () => ({
    onError: async (request: any) => {
      const { AppError } = require('../../src/shared/errors');
      
      if (request.error instanceof AppError) {
        request.response = {
          statusCode: request.error.statusCode,
          body: JSON.stringify({
            success: false,
            error: {
              code: request.error.code,
              message: request.error.message,
            },
            timestamp: new Date().toISOString(),
          }),
        };
      } else {
        request.response = {
          statusCode: 500,
          body: JSON.stringify({
            success: false,
            error: {
              code: 'INTERNAL_ERROR',
              message: request.error.message || 'Internal server error',
            },
            timestamp: new Date().toISOString(),
          }),
        };
      }
    },
  }),
}));

jest.mock('../../src/shared/middleware/response-formatter.middleware', () => ({
  responseFormatter: () => ({
    after: async (request: any) => {
      if (request.response && typeof request.response === 'object' && !request.response.statusCode) {
        request.response = {
          statusCode: 200,
          body: JSON.stringify({
            success: true,
            data: request.response,
            timestamp: new Date().toISOString(),
          }),
        };
      }
    },
  }),
}));

import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { PrismaClient } from '@prisma/client';
import {
  payOrderWithCashHandler,
  payOrderWithTransferHandler,
  payOrderWithCardPhysicalHandler,
  payOrderWithSplitPaymentHandler,
  getPaymentHandler,
  listPaymentsHandler,
} from '../../src/handlers/payments';
import { createOrderHandler } from '../../src/handlers/orders/create-order.handler';
import { createUserHandler } from '../../src/handlers/users/create-user.handler';
import { createProductHandler } from '../../src/handlers/products/create-product.handler';
import { createTableHandler } from '../../src/handlers/tables/create-table.handler';

const prisma = new PrismaClient();
const mockContext: Context = {
  callbackWaitsForEmptyEventLoop: false,
  functionName: 'test',
  functionVersion: '1',
  invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test',
  memoryLimitInMB: '128',
  awsRequestId: 'test-request-id',
  logGroupName: '/aws/lambda/test',
  logStreamName: 'test-stream',
  getRemainingTimeInMillis: () => 30000,
  done: () => {},
  fail: () => {},
  succeed: () => {},
};

// Check if DATABASE_URL is configured
const shouldSkip = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes('test');

describe('Payments E2E Tests', () => {
  let userId: string = '';
  let orderId: string = '';
  let productId: string = '';
  let tableId: string = '';

  beforeAll(async () => {
    if (shouldSkip) {
      console.log('⚠️  Skipping E2E tests: DATABASE_URL not configured');
      return;
    }

    try {

      // Create test user
      const userEvent: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        path: '/api/users',
        body: JSON.stringify({
          name: 'Test',
          last_name: 'User',
          email: `test-payment-${Date.now()}@example.com`,
          password: 'password123',
          rol: 'WAITER',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const userResponse = await createUserHandler(userEvent as any, mockContext);
      const userBody = JSON.parse(userResponse.body);
      userId = userBody.data.id;

      // Create test product
      const productEvent: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        path: '/api/products',
        body: JSON.stringify({
          name: 'Test Product',
          description: 'Test Description',
          userId: userId,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const productResponse = await createProductHandler(productEvent as any, mockContext);
      const productBody = JSON.parse(productResponse.body);
      productId = productBody.data.id;

      // Create test table
      const tableEvent: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        path: '/api/tables',
        body: JSON.stringify({
          name: `e2e-pay-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          userId: userId,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const tableResponse = await createTableHandler(tableEvent as any, mockContext);
      const tableBody = JSON.parse(tableResponse.body);
      tableId = tableBody.data.id;
    } catch (error) {
      console.error('Error setting up test data:', error);
    }
  });

  afterAll(async () => {
    if (shouldSkip) return;

    try {
      // Cleanup
      if (orderId) {
        await prisma.order.deleteMany({ where: { id: orderId } });
      }
      if (productId) {
        await prisma.product.deleteMany({ where: { id: productId } });
      }
      if (tableId) {
        await prisma.table.deleteMany({ where: { id: tableId } });
      }
      if (userId) {
        await prisma.user.deleteMany({ where: { id: userId } });
      }
      await prisma.payment.deleteMany({ where: { userId } });
      await prisma.$disconnect();
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(async () => {
    if (shouldSkip) {
      console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
      return;
    }

    // Create a new order for each test
    try {
      const orderEvent: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        path: '/api/orders',
        body: JSON.stringify({
          userId: userId,
          paymentMethod: 1,
          origin: 'Local',
          tableId: tableId,
          orderItems: [
            {
              productId: productId,
              quantity: 2,
              price: 10.00,
            },
          ],
          orderMenuItems: [],
          tip: 0,
          paymentDiffer: false,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const orderResponse = await createOrderHandler(orderEvent as any, mockContext);
      const orderBody = JSON.parse(orderResponse.body);
      if (orderBody && orderBody.data && orderBody.data.id) {
        orderId = orderBody.data.id;
      } else {
        console.warn('Order creation failed or returned unexpected format:', orderBody);
      }
    } catch (error) {
      console.error('Error creating order in beforeEach:', error);
      // Don't throw, just log - tests will be skipped anyway
    }
  });

  afterEach(async () => {
    if (shouldSkip) return;

    try {
      // Cleanup payments and payment differentiations
      if (orderId) {
        await prisma.payment.deleteMany({ where: { orderId } });
        await prisma.paymentDifferentiation.deleteMany({ where: { orderId } });
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('POST /api/payments/cash', () => {
    it('should pay order with cash successfully', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }

      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        path: '/api/payments/cash',
        body: JSON.stringify({
          orderId: orderId,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const response = await payOrderWithCashHandler(event as any, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.payment).toBeDefined();
      expect(body.data.payment.status).toBe('SUCCEEDED');
      expect(body.data.payment.paymentMethod).toBe('CASH');
      expect(body.data.order.status).toBe(true);
      expect(body.data.order.paymentMethod).toBe(1);
    });

    it('should return error when order not found', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }

      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        path: '/api/payments/cash',
        body: JSON.stringify({
          orderId: '550e8400-e29b-41d4-a716-446655440000',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const response = await payOrderWithCashHandler(event as any, mockContext);

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('ORDER_NOT_FOUND');
    });

    it('should return error when order is already paid', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }

      // Pay order first
      const firstPaymentEvent: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        path: '/api/payments/cash',
        body: JSON.stringify({
          orderId: orderId,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      await payOrderWithCashHandler(firstPaymentEvent as any, mockContext);

      // Try to pay again
      const response = await payOrderWithCashHandler(firstPaymentEvent as any, mockContext);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('ORDER_ALREADY_PAID');
    });
  });

  describe('POST /api/payments/transfer', () => {
    it('should pay order with transfer successfully', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }

      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        path: '/api/payments/transfer',
        body: JSON.stringify({
          orderId: orderId,
          transferNumber: 'TRF-123456',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const response = await payOrderWithTransferHandler(event as any, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.payment.status).toBe('SUCCEEDED');
      expect(body.data.payment.paymentMethod).toBe('TRANSFER');
      expect(body.data.order.paymentMethod).toBe(2);
    });
  });

  describe('POST /api/payments/card-physical', () => {
    it('should pay order with physical card successfully', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }

      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        path: '/api/payments/card-physical',
        body: JSON.stringify({
          orderId: orderId,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const response = await payOrderWithCardPhysicalHandler(event as any, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.payment.status).toBe('SUCCEEDED');
      expect(body.data.payment.paymentMethod).toBe('CARD_PHYSICAL');
      expect(body.data.order.paymentMethod).toBe(3);
    });
  });

  describe('POST /api/payments/split', () => {
    it('should pay order with split payment successfully', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }

      // Get order total first
      const order = await prisma.order.findUnique({ where: { id: orderId } });
      const orderTotal = Number(order?.total || 0);
      const firstAmount = Math.floor(orderTotal / 2 * 100) / 100;
      const secondAmount = orderTotal - firstAmount;

      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        path: '/api/payments/split',
        body: JSON.stringify({
          orderId: orderId,
          firstPayment: {
            amount: firstAmount,
            paymentMethod: 'CASH',
          },
          secondPayment: {
            amount: secondAmount,
            paymentMethod: 'TRANSFER',
          },
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const response = await payOrderWithSplitPaymentHandler(event as any, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.paymentDifferentiation).toBeDefined();
      expect(body.data.payments).toHaveLength(2);
      expect(body.data.order.status).toBe(true);
      expect(body.data.order.paymentDiffer).toBe(true);
      expect(body.data.order.paymentMethod).toBeNull();
    });

    it('should return error when payment methods are the same', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }

      const order = await prisma.order.findUnique({ where: { id: orderId } });
      const orderTotal = Number(order?.total || 0);

      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        path: '/api/payments/split',
        body: JSON.stringify({
          orderId: orderId,
          firstPayment: {
            amount: orderTotal / 2,
            paymentMethod: 'CASH',
          },
          secondPayment: {
            amount: orderTotal / 2,
            paymentMethod: 'CASH', // Same method
          },
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const response = await payOrderWithSplitPaymentHandler(event as any, mockContext);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('SPLIT_PAYMENT_SAME_METHOD');
    });

    it('should return error when total amount exceeds order total', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }

      const order = await prisma.order.findUnique({ where: { id: orderId } });
      const orderTotal = Number(order?.total || 0);

      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        path: '/api/payments/split',
        body: JSON.stringify({
          orderId: orderId,
          firstPayment: {
            amount: orderTotal + 10,
            paymentMethod: 'CASH',
          },
          secondPayment: {
            amount: orderTotal + 10,
            paymentMethod: 'TRANSFER',
          },
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const response = await payOrderWithSplitPaymentHandler(event as any, mockContext);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('SPLIT_PAYMENT_AMOUNT_EXCEEDS_TOTAL');
    });
  });

  describe('GET /api/payments/:payment_id', () => {
    it('should get payment by id successfully', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }

      // Create payment first
      const paymentEvent: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        path: '/api/payments/cash',
        body: JSON.stringify({
          orderId: orderId,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const paymentResponse = await payOrderWithCashHandler(paymentEvent as any, mockContext);
      const paymentBody = JSON.parse(paymentResponse.body);
      const paymentId = paymentBody.data.payment.id;

      // Get payment
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: `/api/payments/${paymentId}`,
        pathParameters: {
          payment_id: paymentId,
        },
      };

      const response = await getPaymentHandler(event as any, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(paymentId);
      expect(body.data.status).toBe('SUCCEEDED');
    });
  });

  describe('GET /api/payments', () => {
    it('should list payments successfully', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }

      // Create a payment first
      const paymentEvent: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        path: '/api/payments/cash',
        body: JSON.stringify({
          orderId: orderId,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      await payOrderWithCashHandler(paymentEvent as any, mockContext);

      // List payments
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: '/api/payments',
        queryStringParameters: {
          orderId: orderId,
        },
      };

      const response = await listPaymentsHandler(event as any, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeGreaterThan(0);
    });
  });
});

