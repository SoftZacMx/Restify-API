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

// Initialize dependency injection
import '../../src/core/infrastructure/config/dependency-injection';

import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { createOrderHandler } from '../../src/handlers/orders/create-order.handler';
import { getOrderHandler } from '../../src/handlers/orders/get-order.handler';
import { listOrdersHandler } from '../../src/handlers/orders/list-orders.handler';
import { updateOrderHandler } from '../../src/handlers/orders/update-order.handler';
import { deleteOrderHandler } from '../../src/handlers/orders/delete-order.handler';

// Mock context
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

// Mock console.error to avoid noise in test output
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});

describe('Orders E2E Tests', () => {
  let createdOrderId: string;
  let userId: string;
  let productId: string;
  let menuItemId: string;
  let tableId: string;
  let categoryId: string;
  const testTimestamp = Date.now();
  
  // Skip if DATABASE_URL is not set or points to test database
  const shouldSkip = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes('test');
  
  beforeAll(async () => {
    if (shouldSkip) {
      console.log('⚠️  Skipping E2E tests: DATABASE_URL not configured');
      return;
    }
    // Use admin user ID from seed
    userId = '4323300a-77c4-456a-b740-6932e0f2713e';
    
    // Create a product for testing
    const { createProductHandler } = require('../../src/handlers/products/create-product.handler');
    const createProductEvent: Partial<APIGatewayProxyEvent> = {
      httpMethod: 'POST',
      path: '/api/products',
      body: JSON.stringify({
        name: `E2E Test Product for Order ${testTimestamp}`,
        description: 'Test product',
        status: true,
        userId: userId,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    };
    const productResponse = await createProductHandler(createProductEvent as any, mockContext);
    const productBody = JSON.parse(productResponse.body);
    if (productResponse.statusCode !== 200 || !productBody.data) {
      console.error('Failed to create product:', productResponse.statusCode, productBody);
      throw new Error(`Failed to create product: ${JSON.stringify(productBody)}`);
    }
    productId = productBody.data.id;
    
    // Create a menu item for testing
    const { createMenuItemHandler } = require('../../src/handlers/menu-items/create-menu-item.handler');
    // First create a menu category
    const { createMenuCategoryHandler } = require('../../src/handlers/menu-categories/create-menu-category.handler');
    const createCategoryEvent: Partial<APIGatewayProxyEvent> = {
      httpMethod: 'POST',
      path: '/api/menu-categories',
      body: JSON.stringify({
        name: `E2E Test Category Orders ${testTimestamp}`,
        status: true,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    };
    const categoryResponse = await createMenuCategoryHandler(createCategoryEvent as any, mockContext);
    const categoryBody = JSON.parse(categoryResponse.body);
    if (categoryResponse.statusCode !== 200 || !categoryBody.data) {
      console.error('Failed to create category:', categoryResponse.statusCode, categoryBody);
      throw new Error(`Failed to create category: ${JSON.stringify(categoryBody)}`);
    }
    categoryId = categoryBody.data.id;
    
    const createMenuItemEvent: Partial<APIGatewayProxyEvent> = {
      httpMethod: 'POST',
      path: '/api/menu-items',
      body: JSON.stringify({
        name: `E2E Test Menu Item ${testTimestamp}`,
        price: 15.50,
        status: true,
        categoryId: categoryId,
        userId: userId,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    };
    const menuItemResponse = await createMenuItemHandler(createMenuItemEvent as any, mockContext);
    const menuItemBody = JSON.parse(menuItemResponse.body);
    if (menuItemResponse.statusCode !== 200 || !menuItemBody.data) {
      console.error('Failed to create menu item:', menuItemResponse.statusCode, menuItemBody);
      throw new Error(`Failed to create menu item: ${JSON.stringify(menuItemBody)}`);
    }
    menuItemId = menuItemBody.data.id;
    
    // Create a table for testing - use timestamp to avoid conflicts
    const { createTableHandler } = require('../../src/handlers/tables/create-table.handler');
    const tableName = `e2e-order-${testTimestamp}`;
    const createTableEvent: Partial<APIGatewayProxyEvent> = {
      httpMethod: 'POST',
      path: '/api/tables',
      body: JSON.stringify({
        name: tableName,
        status: true,
        availabilityStatus: true,
        userId: userId,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    };
    const tableResponse = await createTableHandler(createTableEvent as any, mockContext);
    const tableBody = JSON.parse(tableResponse.body);
    if (tableResponse.statusCode !== 200 || !tableBody.data) {
      console.error('Failed to create table:', tableResponse.statusCode, tableBody);
      throw new Error(`Failed to create table: ${JSON.stringify(tableBody)}`);
    }
    tableId = tableBody.data.id;
  });

  afterAll(async () => {
    if (shouldSkip) {
      return;
    }

    try {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();

      // Clean up in reverse order of dependencies
      if (createdOrderId) {
        await prisma.orderItem.deleteMany({ where: { orderId: createdOrderId } });
        await prisma.orderMenuItem.deleteMany({ where: { orderId: createdOrderId } });
        await prisma.order.deleteMany({ where: { id: createdOrderId } });
      }
      if (menuItemId) {
        await prisma.orderMenuItem.deleteMany({ where: { menuItemId: menuItemId } });
        await prisma.menuItem.deleteMany({ where: { id: menuItemId } });
      }
      if (categoryId) {
        await prisma.menuCategory.deleteMany({ where: { id: categoryId } });
      }
      if (productId) {
        await prisma.orderItem.deleteMany({ where: { productId: productId } });
        await prisma.product.deleteMany({ where: { id: productId } });
      }
      if (tableId) {
        await prisma.table.deleteMany({ where: { id: tableId } });
      }

      await prisma.$disconnect();
    } catch (error) {
      console.error('Error cleaning up test data:', error);
    }
  });

  describe('Create Order Handler', () => {
    it('should create an order successfully with order items', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        path: '/api/orders',
        body: JSON.stringify({
          userId: userId,
          paymentMethod: 1,
          origin: 'Local',
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

      const response = await createOrderHandler(event as any, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('id');
      expect(body.data.status).toBe(false);
      expect(body.data.origin).toBe('Local');
      expect(body.data.subtotal).toBe(20.00);
      expect(body.data.iva).toBe(3.20);
      expect(body.data.total).toBe(23.20);
      expect(body.data.orderItems).toHaveLength(1);
      expect(body.data.orderItems[0].quantity).toBe(2);
      expect(body.data.orderItems[0].price).toBe(10.00);

      createdOrderId = body.data.id;
    });

    it('should create an order successfully with menu items', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        path: '/api/orders',
        body: JSON.stringify({
          userId: userId,
          paymentMethod: 2,
          origin: 'Delivery',
          orderItems: [],
          orderMenuItems: [
            {
              menuItemId: menuItemId,
              amount: 3,
              unitPrice: 15.50,
              note: 'Extra sauce',
            },
          ],
          tip: 2.50,
          paymentDiffer: false,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const response = await createOrderHandler(event as any, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('id');
      expect(body.data.origin).toBe('Delivery');
      expect(body.data.paymentMethod).toBe(2);
      expect(body.data.tip).toBe(2.50);
      expect(body.data.orderMenuItems).toHaveLength(1);
      expect(body.data.orderMenuItems[0].amount).toBe(3);
      expect(body.data.orderMenuItems[0].unitPrice).toBe(15.50);
      expect(body.data.orderMenuItems[0].note).toBe('Extra sauce');
    });

    it('should create an order successfully with both order items and menu items', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        path: '/api/orders',
        body: JSON.stringify({
          userId: userId,
          paymentMethod: 1,
          tableId: tableId,
          origin: 'Local',
          orderItems: [
            {
              productId: productId,
              quantity: 1,
              price: 10.00,
            },
          ],
          orderMenuItems: [
            {
              menuItemId: menuItemId,
              amount: 2,
              unitPrice: 15.50,
              note: null,
            },
          ],
          tip: 1.00,
          paymentDiffer: false,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const response = await createOrderHandler(event as any, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.tableId).toBe(tableId);
      expect(body.data.orderItems).toHaveLength(1);
      expect(body.data.orderMenuItems).toHaveLength(1);
      // Subtotal: 10 + (15.50 * 2) = 10 + 31 = 41
      // IVA: 41 * 0.16 = 6.56
      // Total: 41 + 6.56 + 1 = 48.56
      expect(body.data.subtotal).toBe(41.00);
      expect(body.data.total).toBeCloseTo(48.56, 2);
    });

    it('should return validation error for invalid userId', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        path: '/api/orders',
        body: JSON.stringify({
          userId: 'invalid-uuid',
          paymentMethod: 1,
          origin: 'Local',
          orderItems: [],
          orderMenuItems: [],
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const response = await createOrderHandler(event as any, mockContext);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return error for non-existent user', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        path: '/api/orders',
        body: JSON.stringify({
          userId: '550e8400-e29b-41d4-a716-446655440000',
          paymentMethod: 1,
          origin: 'Local',
          orderItems: [],
          orderMenuItems: [],
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const response = await createOrderHandler(event as any, mockContext);

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('USER_NOT_FOUND');
    });

    it('should return error when no items provided', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        path: '/api/orders',
        body: JSON.stringify({
          userId: userId,
          paymentMethod: 1,
          origin: 'Local',
          orderItems: [],
          orderMenuItems: [],
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const response = await createOrderHandler(event as any, mockContext);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Get Order Handler', () => {
    it('should get order by ID successfully', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      if (!createdOrderId) {
        console.log('⚠️  Skipping: No order created in previous tests');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: `/api/orders/${createdOrderId}`,
        pathParameters: {
          order_id: createdOrderId,
        },
      };

      const response = await getOrderHandler(event as any, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(createdOrderId);
      expect(body.data.orderItems).toBeDefined();
      expect(body.data.orderMenuItems).toBeDefined();
    });

    it('should return error for non-existent order', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: '/api/orders/550e8400-e29b-41d4-a716-446655440000',
        pathParameters: {
          order_id: '550e8400-e29b-41d4-a716-446655440000',
        },
      };

      const response = await getOrderHandler(event as any, mockContext);

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('ORDER_NOT_FOUND');
    });

    it('should return validation error for invalid UUID', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: '/api/orders/invalid-id',
        pathParameters: {
          order_id: 'invalid-id',
        },
      };

      const response = await getOrderHandler(event as any, mockContext);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('List Orders Handler', () => {
    it('should list all orders successfully', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: '/api/orders',
        queryStringParameters: null,
      };

      const response = await listOrdersHandler(event as any, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('data');
      expect(body.data).toHaveProperty('pagination');
      expect(Array.isArray(body.data.data)).toBe(true);
      expect(body.data.data.length).toBeGreaterThan(0);
      expect(body.data.pagination).toMatchObject({
        page: expect.any(Number),
        limit: expect.any(Number),
        total: expect.any(Number),
        totalPages: expect.any(Number),
      });
    });

    it('should filter orders by status', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: '/api/orders',
        queryStringParameters: {
          status: 'false',
        },
      };

      const response = await listOrdersHandler(event as any, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data.data)).toBe(true);
      body.data.data.forEach((order: any) => {
        expect(order.status).toBe(false);
      });
    });

    it('should filter orders by userId', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: '/api/orders',
        queryStringParameters: {
          userId: userId,
        },
      };

      const response = await listOrdersHandler(event as any, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data.data)).toBe(true);
      body.data.data.forEach((order: any) => {
        expect(order.userId).toBe(userId);
      });
    });

    it('should filter orders by origin', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: '/api/orders',
        queryStringParameters: {
          origin: 'Local',
        },
      };

      const response = await listOrdersHandler(event as any, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data.data)).toBe(true);
      body.data.data.forEach((order: any) => {
        expect(order.origin).toBe('Local');
      });
    });
  });

  describe('Update Order Handler', () => {
    it('should update order successfully', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      if (!createdOrderId) {
        console.log('⚠️  Skipping: No order created in previous tests');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'PUT',
        path: `/api/orders/${createdOrderId}`,
        pathParameters: {
          order_id: createdOrderId,
        },
        body: JSON.stringify({
          status: true,
          delivered: true,
          tip: 5.00,
          note: 'Updated order',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const response = await updateOrderHandler(event as any, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe(true);
      expect(body.data.delivered).toBe(true);
      expect(body.data.tip).toBe(5.00);
      expect(body.data.note).toBe('Updated order');
      expect(body.data.orderItems).toBeDefined();
      expect(body.data.orderMenuItems).toBeDefined();
    });

    it('should return error for non-existent order', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'PUT',
        path: '/api/orders/550e8400-e29b-41d4-a716-446655440000',
        pathParameters: {
          order_id: '550e8400-e29b-41d4-a716-446655440000',
        },
        body: JSON.stringify({
          status: true,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const response = await updateOrderHandler(event as any, mockContext);

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('ORDER_NOT_FOUND');
    });
  });

  describe('Delete Order Handler', () => {
    it('should delete order successfully', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      // Create an order to delete
      const createEvent: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        path: '/api/orders',
        body: JSON.stringify({
          userId: userId,
          paymentMethod: 1,
          origin: 'Local',
          orderItems: [
            {
              productId: productId,
              quantity: 1,
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

      const createResponse = await createOrderHandler(createEvent as any, mockContext);
      const createBody = JSON.parse(createResponse.body);
      const orderIdToDelete = createBody.data.id;

      // Delete the order
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'DELETE',
        path: `/api/orders/${orderIdToDelete}`,
        pathParameters: {
          order_id: orderIdToDelete,
        },
      };

      const response = await deleteOrderHandler(event as any, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.message).toBe('Order deleted successfully');

      // Verify order is deleted
      const getEvent: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: `/api/orders/${orderIdToDelete}`,
        pathParameters: {
          order_id: orderIdToDelete,
        },
      };

      const getResponse = await getOrderHandler(getEvent as any, mockContext);
      expect(getResponse.statusCode).toBe(404);
    });

    it('should return error for non-existent order', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'DELETE',
        path: '/api/orders/550e8400-e29b-41d4-a716-446655440000',
        pathParameters: {
          order_id: '550e8400-e29b-41d4-a716-446655440000',
        },
      };

      const response = await deleteOrderHandler(event as any, mockContext);

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('ORDER_NOT_FOUND');
    });

    it('should return validation error for invalid UUID', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'DELETE',
        path: '/api/orders/invalid-id',
        pathParameters: {
          order_id: 'invalid-id',
        },
      };

      const response = await deleteOrderHandler(event as any, mockContext);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});

