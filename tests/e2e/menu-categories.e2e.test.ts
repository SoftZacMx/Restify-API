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
import { createMenuCategoryHandler } from '../../src/handlers/menu-categories/create-menu-category.handler';
import { getMenuCategoryHandler } from '../../src/handlers/menu-categories/get-menu-category.handler';
import { listMenuCategoriesHandler } from '../../src/handlers/menu-categories/list-menu-categories.handler';
import { updateMenuCategoryHandler } from '../../src/handlers/menu-categories/update-menu-category.handler';
import { deleteMenuCategoryHandler } from '../../src/handlers/menu-categories/delete-menu-category.handler';

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

describe('Menu Categories E2E Tests', () => {
  let createdCategoryId: string;
  let duplicateTestCategoryId: string;
  const testTimestamp = Date.now();
  
  // Skip if DATABASE_URL is not set or points to test database
  const shouldSkip = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes('test');

  describe('Create Menu Category Handler', () => {
    it('should create a menu category successfully', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const categoryName = `E2E Test Category ${testTimestamp}`;
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        path: '/api/menu-categories',
        body: JSON.stringify({
          name: categoryName,
          status: true,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const response = await createMenuCategoryHandler(event as any, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('id');
      expect(body.data.name).toBe(categoryName);
      expect(body.data.status).toBe(true);

      createdCategoryId = body.data.id;
    });

    it('should return validation error for duplicate category name', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      // First create a category
      const duplicateCategoryName = `E2E Duplicate Test ${testTimestamp}`;
      const createEvent: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        path: '/api/menu-categories',
        body: JSON.stringify({
          name: duplicateCategoryName,
          status: true,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };
      const createResponse = await createMenuCategoryHandler(createEvent as any, mockContext);
      const createBody = JSON.parse(createResponse.body);
      duplicateTestCategoryId = createBody.data.id;
      
      // Now try to create another with the same name
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        path: '/api/menu-categories',
        body: JSON.stringify({
          name: duplicateCategoryName,
          status: true,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const response = await createMenuCategoryHandler(event as any, mockContext);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return validation error for empty name', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        path: '/api/menu-categories',
        body: JSON.stringify({
          name: '',
          status: true,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const response = await createMenuCategoryHandler(event as any, mockContext);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Get Menu Category Handler', () => {
    it('should get menu category by ID successfully', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: `/api/menu-categories/${createdCategoryId}`,
        pathParameters: {
          category_id: createdCategoryId,
        },
      };

      const response = await getMenuCategoryHandler(event as any, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(createdCategoryId);
      expect(body.data.name).toContain('E2E Test Category');
    });

    it('should return error for non-existent category', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: '/api/menu-categories/550e8400-e29b-41d4-a716-446655440000',
        pathParameters: {
          category_id: '550e8400-e29b-41d4-a716-446655440000',
        },
      };

      const response = await getMenuCategoryHandler(event as any, mockContext);

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('MENU_CATEGORY_NOT_FOUND');
    });

    it('should return validation error for invalid UUID', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: '/api/menu-categories/invalid-id',
        pathParameters: {
          category_id: 'invalid-id',
        },
      };

      const response = await getMenuCategoryHandler(event as any, mockContext);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('List Menu Categories Handler', () => {
    it('should list all menu categories successfully', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: '/api/menu-categories',
        queryStringParameters: null,
      };

      const response = await listMenuCategoriesHandler(event as any, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeGreaterThan(0);
    });

    it('should filter categories by status', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: '/api/menu-categories',
        queryStringParameters: {
          status: 'true',
        },
      };

      const response = await listMenuCategoriesHandler(event as any, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      body.data.forEach((category: any) => {
        expect(category.status).toBe(true);
      });
    });

    it('should filter categories by search', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: '/api/menu-categories',
        queryStringParameters: {
          search: 'E2E',
        },
      };

      const response = await listMenuCategoriesHandler(event as any, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      body.data.forEach((category: any) => {
        expect(category.name).toContain('E2E');
      });
    });
  });

  describe('Update Menu Category Handler', () => {
    it('should update menu category successfully', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'PUT',
        path: `/api/menu-categories/${createdCategoryId}`,
        pathParameters: {
          category_id: createdCategoryId,
        },
        body: JSON.stringify({
          status: false,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const response = await updateMenuCategoryHandler(event as any, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe(false);
    });

    it('should return error for non-existent category', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'PUT',
        path: '/api/menu-categories/550e8400-e29b-41d4-a716-446655440000',
        pathParameters: {
          category_id: '550e8400-e29b-41d4-a716-446655440000',
        },
        body: JSON.stringify({
          status: false,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const response = await updateMenuCategoryHandler(event as any, mockContext);

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('MENU_CATEGORY_NOT_FOUND');
    });
  });

  describe('Delete Menu Category Handler', () => {
    it('should delete menu category successfully', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      // Create a category to delete
      const createEvent: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        path: '/api/menu-categories',
        body: JSON.stringify({
          name: 'E2E Delete Test',
          status: true,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const createResponse = await createMenuCategoryHandler(createEvent as any, mockContext);
      const createBody = JSON.parse(createResponse.body);
      const categoryIdToDelete = createBody.data.id;

      // Delete the category
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'DELETE',
        path: `/api/menu-categories/${categoryIdToDelete}`,
        pathParameters: {
          category_id: categoryIdToDelete,
        },
      };

      const response = await deleteMenuCategoryHandler(event as any, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.message).toBe('Menu category deleted successfully');

      // Verify category is deleted
      const getEvent: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: `/api/menu-categories/${categoryIdToDelete}`,
        pathParameters: {
          category_id: categoryIdToDelete,
        },
      };

      const getResponse = await getMenuCategoryHandler(getEvent as any, mockContext);
      expect(getResponse.statusCode).toBe(404);
    });

    it('should return error for non-existent category', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'DELETE',
        path: '/api/menu-categories/550e8400-e29b-41d4-a716-446655440000',
        pathParameters: {
          category_id: '550e8400-e29b-41d4-a716-446655440000',
        },
      };

      const response = await deleteMenuCategoryHandler(event as any, mockContext);

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('MENU_CATEGORY_NOT_FOUND');
    });

    it('should return validation error for invalid UUID', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'DELETE',
        path: '/api/menu-categories/invalid-id',
        pathParameters: {
          category_id: 'invalid-id',
        },
      };

      const response = await deleteMenuCategoryHandler(event as any, mockContext);

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

      // Clean up categories (delete menu items first if they exist)
      if (duplicateTestCategoryId) {
        await prisma.menuItem.deleteMany({ where: { categoryId: duplicateTestCategoryId } });
        await prisma.menuCategory.deleteMany({ where: { id: duplicateTestCategoryId } });
      }
      if (createdCategoryId) {
        await prisma.menuItem.deleteMany({ where: { categoryId: createdCategoryId } });
        await prisma.menuCategory.deleteMany({ where: { id: createdCategoryId } });
      }

      await prisma.$disconnect();
    } catch (error) {
      console.error('Error cleaning up test data:', error);
    }
  });
});

