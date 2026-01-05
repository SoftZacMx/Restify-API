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
import { createProductHandler } from '../../src/handlers/products/create-product.handler';
import { getProductHandler } from '../../src/handlers/products/get-product.handler';
import { listProductsHandler } from '../../src/handlers/products/list-products.handler';
import { updateProductHandler } from '../../src/handlers/products/update-product.handler';
import { deleteProductHandler } from '../../src/handlers/products/delete-product.handler';

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

describe('Products E2E Tests', () => {
  let createdProductId: string;
  let userId: string;
  const testTimestamp = Date.now();
  
  // Skip if DATABASE_URL is not set or points to test database
  const shouldSkip = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes('test');
  
  beforeAll(async () => {
    if (shouldSkip) {
      console.log('⚠️  Skipping E2E tests: DATABASE_URL not configured');
      return;
    }
    // Get a valid user ID for testing
    userId = '4323300a-77c4-456a-b740-6932e0f2713e'; // Admin user ID from seed
  });

  describe('Create Product Handler', () => {
    it('should create a product successfully', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const productName = `E2E Test Product ${testTimestamp}`;
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        path: '/api/products',
        body: JSON.stringify({
          name: productName,
          description: 'Test description',
          status: true,
          userId: userId,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const response = await createProductHandler(event as any, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('id');
      expect(body.data.name).toBe(productName);
      expect(body.data.status).toBe(true);

      createdProductId = body.data.id;
    });

    it('should return validation error for invalid userId', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        path: '/api/products',
        body: JSON.stringify({
          name: 'Test Product',
          description: 'Test',
          status: true,
          userId: 'invalid-uuid',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const response = await createProductHandler(event as any, mockContext);

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
        path: '/api/products',
        body: JSON.stringify({
          name: 'Test Product',
          description: 'Test',
          status: true,
          userId: '550e8400-e29b-41d4-a716-446655440000',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const response = await createProductHandler(event as any, mockContext);

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('USER_NOT_FOUND');
    });
  });

  describe('Get Product Handler', () => {
    it('should get product by ID successfully', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: `/api/products/${createdProductId}`,
        pathParameters: {
          product_id: createdProductId,
        },
      };

      const response = await getProductHandler(event as any, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(createdProductId);
      expect(body.data.name).toContain('E2E Test Product');
    });

    it('should return error for non-existent product', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: '/api/products/550e8400-e29b-41d4-a716-446655440000',
        pathParameters: {
          product_id: '550e8400-e29b-41d4-a716-446655440000',
        },
      };

      const response = await getProductHandler(event as any, mockContext);

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('PRODUCT_NOT_FOUND');
    });

    it('should return validation error for invalid UUID', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: '/api/products/invalid-id',
        pathParameters: {
          product_id: 'invalid-id',
        },
      };

      const response = await getProductHandler(event as any, mockContext);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('List Products Handler', () => {
    it('should list all products successfully', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: '/api/products',
        queryStringParameters: null,
      };

      const response = await listProductsHandler(event as any, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeGreaterThan(0);
    });

    it('should filter products by status', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: '/api/products',
        queryStringParameters: {
          status: 'true',
        },
      };

      const response = await listProductsHandler(event as any, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      body.data.forEach((product: any) => {
        expect(product.status).toBe(true);
      });
    });
  });

  describe('Update Product Handler', () => {
    it('should update product successfully', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'PUT',
        path: `/api/products/${createdProductId}`,
        pathParameters: {
          product_id: createdProductId,
        },
        body: JSON.stringify({
          name: 'Updated E2E Product',
          status: false,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const response = await updateProductHandler(event as any, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.name).toBe('Updated E2E Product');
      expect(body.data.status).toBe(false);
    });

    it('should return error for non-existent product', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'PUT',
        path: '/api/products/550e8400-e29b-41d4-a716-446655440000',
        pathParameters: {
          product_id: '550e8400-e29b-41d4-a716-446655440000',
        },
        body: JSON.stringify({
          name: 'Updated',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const response = await updateProductHandler(event as any, mockContext);

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('PRODUCT_NOT_FOUND');
    });
  });

  describe('Delete Product Handler', () => {
    it('should delete product successfully', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      // Create a product to delete
      const createEvent: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        path: '/api/products',
        body: JSON.stringify({
          name: 'Delete Test Product',
          description: 'Test',
          status: true,
          userId: userId,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const createResponse = await createProductHandler(createEvent as any, mockContext);
      const createBody = JSON.parse(createResponse.body);
      const productIdToDelete = createBody.data.id;

      // Delete the product
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'DELETE',
        path: `/api/products/${productIdToDelete}`,
        pathParameters: {
          product_id: productIdToDelete,
        },
      };

      const response = await deleteProductHandler(event as any, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.message).toBe('Product deleted successfully');

      // Verify product is deleted
      const getEvent: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: `/api/products/${productIdToDelete}`,
        pathParameters: {
          product_id: productIdToDelete,
        },
      };

      const getResponse = await getProductHandler(getEvent as any, mockContext);
      expect(getResponse.statusCode).toBe(404);
    });

    it('should return error for non-existent product', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'DELETE',
        path: '/api/products/550e8400-e29b-41d4-a716-446655440000',
        pathParameters: {
          product_id: '550e8400-e29b-41d4-a716-446655440000',
        },
      };

      const response = await deleteProductHandler(event as any, mockContext);

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('PRODUCT_NOT_FOUND');
    });

    it('should return validation error for invalid UUID', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'DELETE',
        path: '/api/products/invalid-id',
        pathParameters: {
          product_id: 'invalid-id',
        },
      };

      const response = await deleteProductHandler(event as any, mockContext);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  afterAll(async () => {
    if (shouldSkip) {
      return;
    }

    try {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();

      // Clean up products (delete order items first if they exist)
      if (createdProductId) {
        await prisma.orderItem.deleteMany({ where: { productId: createdProductId } });
        await prisma.product.deleteMany({ where: { id: createdProductId } });
      }

      await prisma.$disconnect();
    } catch (error) {
      console.error('Error cleaning up test data:', error);
    }
  });
});

