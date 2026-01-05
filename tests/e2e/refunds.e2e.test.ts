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

import request from 'supertest';
import LocalServer from '../../src/server/server';
import { PrismaClient } from '@prisma/client';
import { PaymentStatus, PaymentMethod, PaymentGateway, RefundStatus } from '@prisma/client';
import { ZodError } from 'zod';

const server = new LocalServer();
const app = server.getApp();

const prisma = new PrismaClient();

// Skip tests if DATABASE_URL is not configured
const shouldSkip = !process.env.DATABASE_URL;

describe('Refunds E2E Tests', () => {
  let testPaymentId: string;
  let testOrderId: string;
  let testUserId: string;
  let testTableId: string;
  let testProductId: string;
  let testMenuId: string;
  let testMenuCategoryId: string;

  beforeAll(async () => {
    if (shouldSkip) {
      console.log('Skipping E2E tests: DATABASE_URL not configured');
      return;
    }

    // Create test user
    const user = await prisma.user.create({
      data: {
        email: `test-refund-${Date.now()}@example.com`,
        password: 'hashedpassword',
        name: 'Test User',
        last_name: 'Test Last Name',
        rol: 'WAITER',
      },
    });
    testUserId = user.id;

    // Create test table
    const table = await prisma.table.create({
      data: {
        numberTable: Math.floor(Math.random() * 1000),
        userId: testUserId,
        status: true,
        availabilityStatus: true,
      },
    });
    testTableId = table.id;

    // Create test product
    const product = await prisma.product.create({
      data: {
        name: 'Test Product',
        description: 'Test product for refunds',
        status: true,
        userId: testUserId,
      },
    });
    testProductId = product.id;

    // Create test menu category
    const menuCategory = await prisma.menuCategory.create({
      data: {
        name: 'Test Category',
        status: true,
      },
    });
    testMenuCategoryId = menuCategory.id;

    // Create test menu item
    const menuItem = await prisma.menuItem.create({
      data: {
        name: 'Test Menu Item',
        price: 15.00,
        status: true,
        categoryId: menuCategory.id,
        userId: testUserId,
      },
    });
    testMenuId = menuItem.id;

    // Create test order
    const order = await prisma.order.create({
      data: {
        date: new Date(),
        status: true,
        paymentMethod: 1, // Cash
        total: 100.00,
        subtotal: 90.00,
        iva: 10.00,
        delivered: false,
        tableId: testTableId,
        userId: testUserId,
        tip: 0,
        origin: 'RESTAURANT',
        client: 'Test Client',
        paymentDiffer: false,
        note: null,
      },
    });
    testOrderId = order.id;

    // Create test payment (SUCCEEDED)
    const payment = await prisma.payment.create({
      data: {
        orderId: testOrderId,
        userId: testUserId,
        amount: 100.00,
        currency: 'USD',
        paymentMethod: PaymentMethod.CASH,
        status: PaymentStatus.SUCCEEDED,
        gateway: PaymentGateway.CASH, // Use CASH gateway for cash payments
      },
    });
    testPaymentId = payment.id;
  });

  afterAll(async () => {
    if (shouldSkip) {
      return;
    }

    try {
      // Clean up test data
      if (testPaymentId) {
        await prisma.refund.deleteMany({
          where: { paymentId: testPaymentId },
        });
        await prisma.payment.deleteMany({
          where: { id: testPaymentId },
        });
      }
      if (testOrderId) {
        await prisma.order.deleteMany({
          where: { id: testOrderId },
        });
      }
      if (testProductId) {
        await prisma.product.deleteMany({
          where: { id: testProductId },
        });
      }
      if (testMenuId) {
        await prisma.menuItem.deleteMany({
          where: { id: testMenuId },
        });
      }
      if (testMenuCategoryId) {
        await prisma.menuCategory.deleteMany({
          where: { id: testMenuCategoryId },
        });
      }
      if (testTableId) {
        await prisma.table.deleteMany({
          where: { id: testTableId },
        });
      }
      if (testUserId) {
        await prisma.user.deleteMany({
          where: { id: testUserId },
        });
      }
    } catch (error) {
      console.error('Error cleaning up test data:', error);
    } finally {
      await prisma.$disconnect();
    }
  });

  describe('POST /api/refunds', () => {
    it('should create a refund successfully', async () => {
      if (shouldSkip) {
        console.log('Skipping E2E test: DATABASE_URL not configured');
        return;
      }

      const response = await request(app)
        .post('/api/refunds')
        .send({
          paymentId: testPaymentId,
          amount: 50.00,
          reason: 'Customer requested partial refund',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.refund).toBeDefined();
      expect(response.body.data.refund.amount).toBe(50.00);
      expect(response.body.data.refund.status).toBe(RefundStatus.SUCCEEDED);
      expect(response.body.data.payment).toBeDefined();
      expect(response.body.data.payment.status).toBe(PaymentStatus.PARTIALLY_REFUNDED);
    });

    it('should create a full refund', async () => {
      if (shouldSkip) {
        console.log('Skipping E2E test: DATABASE_URL not configured');
        return;
      }

      // Create another payment for full refund test
      const order = await prisma.order.create({
        data: {
          date: new Date(),
          status: true,
          paymentMethod: 1,
          total: 50.00,
          subtotal: 45.00,
          iva: 5.00,
          delivered: false,
          tableId: testTableId,
        userId: testUserId,
          tip: 0,
          origin: 'RESTAURANT',
          client: 'Test Client',
          paymentDiffer: false,
          note: null,
        },
      });

      const payment = await prisma.payment.create({
        data: {
          orderId: order.id,
          userId: testUserId,
          amount: 50.00,
          currency: 'USD',
          paymentMethod: PaymentMethod.CASH,
          status: PaymentStatus.SUCCEEDED,
          gateway: PaymentGateway.CASH, // Use CASH gateway for cash payments
        },
      });

      const response = await request(app)
        .post('/api/refunds')
        .send({
          paymentId: payment.id,
          amount: 50.00,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.refund.amount).toBe(50.00);
      expect(response.body.data.payment.status).toBe(PaymentStatus.REFUNDED);

      // Cleanup
      await prisma.refund.deleteMany({ where: { paymentId: payment.id } });
      await prisma.payment.deleteMany({ where: { id: payment.id } });
      await prisma.order.deleteMany({ where: { id: order.id } });
    });

    it('should return 400 if payment not found', async () => {
      if (shouldSkip) {
        console.log('Skipping E2E test: DATABASE_URL not configured');
        return;
      }

      const response = await request(app)
        .post('/api/refunds')
        .send({
          paymentId: 'non-existent-payment-id',
          amount: 50.00,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('PAYMENT_NOT_FOUND');
    });

    it('should return 400 if payment is not SUCCEEDED', async () => {
      if (shouldSkip) {
        console.log('Skipping E2E test: DATABASE_URL not configured');
        return;
      }

      const order = await prisma.order.create({
        data: {
          date: new Date(),
          status: true,
          paymentMethod: 1,
          total: 50.00,
          subtotal: 45.00,
          iva: 5.00,
          delivered: false,
          tableId: testTableId,
          userId: testUserId,
          tip: 0,
          origin: 'RESTAURANT',
          client: 'Test Client',
          paymentDiffer: false,
          note: null,
        },
      });

      const payment = await prisma.payment.create({
        data: {
          orderId: order.id,
          userId: testUserId,
          amount: 50.00,
          currency: 'USD',
          paymentMethod: PaymentMethod.CASH,
          status: PaymentStatus.PENDING,
          gateway: PaymentGateway.CASH, // Use CASH gateway for cash payments
        },
      });

      const response = await request(app)
        .post('/api/refunds')
        .send({
          paymentId: payment.id,
          amount: 50.00,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('PAYMENT_NOT_REFUNDABLE');

      // Cleanup
      await prisma.payment.deleteMany({ where: { id: payment.id } });
      await prisma.order.deleteMany({ where: { id: order.id } });
    });

    it('should return 400 if refund amount exceeds remaining', async () => {
      if (shouldSkip) {
        console.log('Skipping E2E test: DATABASE_URL not configured');
        return;
      }

      const response = await request(app)
        .post('/api/refunds')
        .send({
          paymentId: testPaymentId,
          amount: 200.00, // More than payment amount
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('REFUND_AMOUNT_EXCEEDS_REMAINING');
    });

    it('should return 400 if validation fails', async () => {
      if (shouldSkip) {
        console.log('Skipping E2E test: DATABASE_URL not configured');
        return;
      }

      const response = await request(app)
        .post('/api/refunds')
        .send({
          paymentId: 'invalid-uuid',
          amount: -10.00,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      const error = response.body.error;
      expect(error).toBeDefined();
      if (error.errors) {
        // Zod validation errors
        expect(Array.isArray((error as ZodError).errors)).toBe(true);
      }
    });
  });

  describe('GET /api/refunds/:refund_id', () => {
    let testRefundId: string;

    beforeEach(async () => {
      if (shouldSkip) {
        console.log('Skipping E2E test: DATABASE_URL not configured');
        return;
      }

      // Create a test refund
      const refund = await prisma.refund.create({
        data: {
          paymentId: testPaymentId,
          amount: 25.00,
          reason: 'Test refund',
          gatewayRefundId: null,
          status: RefundStatus.SUCCEEDED,
        },
      });
      testRefundId = refund.id;
    });

    afterEach(async () => {
      if (shouldSkip) {
        console.log('Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      if (testRefundId) {
        await prisma.refund.deleteMany({
          where: { id: testRefundId },
        });
      }
    });

    it('should get a refund by id', async () => {
      if (shouldSkip) {
        console.log('Skipping E2E test: DATABASE_URL not configured');
        return;
      }

      const response = await request(app)
        .get(`/api/refunds/${testRefundId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testRefundId);
      expect(response.body.data.amount).toBe(25.00);
      expect(response.body.data.status).toBe(RefundStatus.SUCCEEDED);
    });

    it('should return 404 if refund not found', async () => {
      if (shouldSkip) {
        console.log('Skipping E2E test: DATABASE_URL not configured');
        return;
      }

      const response = await request(app)
        .get('/api/refunds/non-existent-refund-id')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('REFUND_NOT_FOUND');
    });

    it('should return 400 if invalid UUID format', async () => {
      if (shouldSkip) {
        console.log('Skipping E2E test: DATABASE_URL not configured');
        return;
      }

      const response = await request(app)
        .get('/api/refunds/invalid-uuid')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/refunds', () => {
    it('should list all refunds', async () => {
      if (shouldSkip) {
        console.log('Skipping E2E test: DATABASE_URL not configured');
        return;
      }

      const response = await request(app)
        .get('/api/refunds')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should filter refunds by paymentId', async () => {
      if (shouldSkip) {
        console.log('Skipping E2E test: DATABASE_URL not configured');
        return;
      }

      const response = await request(app)
        .get(`/api/refunds?paymentId=${testPaymentId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      if (response.body.data.length > 0) {
        expect(response.body.data[0].paymentId).toBe(testPaymentId);
      }
    });

    it('should filter refunds by status', async () => {
      if (shouldSkip) {
        console.log('Skipping E2E test: DATABASE_URL not configured');
        return;
      }

      const response = await request(app)
        .get(`/api/refunds?status=${RefundStatus.SUCCEEDED}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });
});

