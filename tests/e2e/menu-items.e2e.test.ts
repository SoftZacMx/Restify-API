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
import { createMenuItemHandler } from '../../src/handlers/menu-items/create-menu-item.handler';
import { getMenuItemHandler } from '../../src/handlers/menu-items/get-menu-item.handler';
import { listMenuItemsHandler } from '../../src/handlers/menu-items/list-menu-items.handler';
import { updateMenuItemHandler } from '../../src/handlers/menu-items/update-menu-item.handler';
import { deleteMenuItemHandler } from '../../src/handlers/menu-items/delete-menu-item.handler';
import { createMenuCategoryHandler } from '../../src/handlers/menu-categories/create-menu-category.handler';

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

describe('Menu Items E2E Tests', () => {
  let createdMenuItemId: string;
  let userId: string;
  let categoryId: string;
  
  // Skip if DATABASE_URL is not set or points to test database
  const shouldSkip = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes('test');
  
  beforeAll(async () => {
    if (shouldSkip) {
      console.log('⚠️  Skipping E2E tests: DATABASE_URL not configured');
      return;
    }
    // Get a valid user ID for testing
    userId = '4323300a-77c4-456a-b740-6932e0f2713e'; // Admin user ID from seed
    
    // Create a category for testing
    const categoryEvent: Partial<APIGatewayProxyEvent> = {
      httpMethod: 'POST',
      path: '/api/menu-categories',
      body: JSON.stringify({
        name: 'E2E Test Category',
        status: true,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const categoryResponse = await createMenuCategoryHandler(categoryEvent as any, mockContext);
    const categoryBody = JSON.parse(categoryResponse.body);
    categoryId = categoryBody.data.id;
  });

  describe('Create Menu Item Handler', () => {
    it('should create a menu item successfully', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        path: '/api/menu-items',
        body: JSON.stringify({
          name: 'E2E Test Menu Item',
          price: 15.99,
          status: true,
          categoryId: categoryId,
          userId: userId,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const response = await createMenuItemHandler(event as any, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('id');
      expect(body.data.name).toBe('E2E Test Menu Item');
      expect(body.data.price).toBe(15.99);
      expect(body.data.status).toBe(true);

      createdMenuItemId = body.data.id;
    });

    it('should return validation error for invalid categoryId', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        path: '/api/menu-items',
        body: JSON.stringify({
          name: 'Test Item',
          price: 10.50,
          status: true,
          categoryId: 'invalid-uuid',
          userId: userId,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const response = await createMenuItemHandler(event as any, mockContext);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return validation error for invalid userId', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        path: '/api/menu-items',
        body: JSON.stringify({
          name: 'Test Item',
          price: 10.50,
          status: true,
          categoryId: categoryId,
          userId: 'invalid-uuid',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const response = await createMenuItemHandler(event as any, mockContext);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return error for non-existent category', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        path: '/api/menu-items',
        body: JSON.stringify({
          name: 'Test Item',
          price: 10.50,
          status: true,
          categoryId: '550e8400-e29b-41d4-a716-446655440000',
          userId: userId,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const response = await createMenuItemHandler(event as any, mockContext);

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('MENU_CATEGORY_NOT_FOUND');
    });

    it('should return error for non-existent user', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        path: '/api/menu-items',
        body: JSON.stringify({
          name: 'Test Item',
          price: 10.50,
          status: true,
          categoryId: categoryId,
          userId: '550e8400-e29b-41d4-a716-446655440000',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const response = await createMenuItemHandler(event as any, mockContext);

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('USER_NOT_FOUND');
    });

    it('should return validation error for negative price', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        path: '/api/menu-items',
        body: JSON.stringify({
          name: 'Test Item',
          price: -10.50,
          status: true,
          categoryId: categoryId,
          userId: userId,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const response = await createMenuItemHandler(event as any, mockContext);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Get Menu Item Handler', () => {
    it('should get menu item by ID successfully', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: `/api/menu-items/${createdMenuItemId}`,
        pathParameters: {
          menu_item_id: createdMenuItemId,
        },
      };

      const response = await getMenuItemHandler(event as any, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(createdMenuItemId);
      expect(body.data.name).toBe('E2E Test Menu Item');
      expect(body.data.price).toBe(15.99);
    });

    it('should return error for non-existent menu item', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: '/api/menu-items/550e8400-e29b-41d4-a716-446655440000',
        pathParameters: {
          menu_item_id: '550e8400-e29b-41d4-a716-446655440000',
        },
      };

      const response = await getMenuItemHandler(event as any, mockContext);

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('MENU_ITEM_NOT_FOUND');
    });

    it('should return validation error for invalid UUID', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: '/api/menu-items/invalid-id',
        pathParameters: {
          menu_item_id: 'invalid-id',
        },
      };

      const response = await getMenuItemHandler(event as any, mockContext);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('List Menu Items Handler', () => {
    it('should list all menu items successfully', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: '/api/menu-items',
        queryStringParameters: null,
      };

      const response = await listMenuItemsHandler(event as any, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeGreaterThan(0);
    });

    it('should filter menu items by status', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: '/api/menu-items',
        queryStringParameters: {
          status: 'true',
        },
      };

      const response = await listMenuItemsHandler(event as any, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      body.data.forEach((item: any) => {
        expect(item.status).toBe(true);
      });
    });

    it('should filter menu items by categoryId', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: '/api/menu-items',
        queryStringParameters: {
          categoryId: categoryId,
        },
      };

      const response = await listMenuItemsHandler(event as any, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      body.data.forEach((item: any) => {
        expect(item.categoryId).toBe(categoryId);
      });
    });

    it('should filter menu items by search', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: '/api/menu-items',
        queryStringParameters: {
          search: 'E2E',
        },
      };

      const response = await listMenuItemsHandler(event as any, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      body.data.forEach((item: any) => {
        expect(item.name).toContain('E2E');
      });
    });
  });

  describe('Update Menu Item Handler', () => {
    it('should update menu item successfully', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'PUT',
        path: `/api/menu-items/${createdMenuItemId}`,
        pathParameters: {
          menu_item_id: createdMenuItemId,
        },
        body: JSON.stringify({
          price: 18.99,
          status: false,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const response = await updateMenuItemHandler(event as any, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.price).toBe(18.99);
      expect(body.data.status).toBe(false);
    });

    it('should return error for non-existent menu item', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'PUT',
        path: '/api/menu-items/550e8400-e29b-41d4-a716-446655440000',
        pathParameters: {
          menu_item_id: '550e8400-e29b-41d4-a716-446655440000',
        },
        body: JSON.stringify({
          price: 20.00,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const response = await updateMenuItemHandler(event as any, mockContext);

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('MENU_ITEM_NOT_FOUND');
    });
  });

  describe('Delete Menu Item Handler', () => {
    it('should delete menu item successfully', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      // Create a menu item to delete
      const createEvent: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        path: '/api/menu-items',
        body: JSON.stringify({
          name: 'E2E Delete Test',
          price: 5.00,
          status: true,
          categoryId: categoryId,
          userId: userId,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const createResponse = await createMenuItemHandler(createEvent as any, mockContext);
      const createBody = JSON.parse(createResponse.body);
      const menuItemIdToDelete = createBody.data.id;

      // Delete the menu item
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'DELETE',
        path: `/api/menu-items/${menuItemIdToDelete}`,
        pathParameters: {
          menu_item_id: menuItemIdToDelete,
        },
      };

      const response = await deleteMenuItemHandler(event as any, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.message).toBe('Menu item deleted successfully');

      // Verify menu item is deleted
      const getEvent: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: `/api/menu-items/${menuItemIdToDelete}`,
        pathParameters: {
          menu_item_id: menuItemIdToDelete,
        },
      };

      const getResponse = await getMenuItemHandler(getEvent as any, mockContext);
      expect(getResponse.statusCode).toBe(404);
    });

    it('should return error for non-existent menu item', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'DELETE',
        path: '/api/menu-items/550e8400-e29b-41d4-a716-446655440000',
        pathParameters: {
          menu_item_id: '550e8400-e29b-41d4-a716-446655440000',
        },
      };

      const response = await deleteMenuItemHandler(event as any, mockContext);

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('MENU_ITEM_NOT_FOUND');
    });

    it('should return validation error for invalid UUID', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'DELETE',
        path: '/api/menu-items/invalid-id',
        pathParameters: {
          menu_item_id: 'invalid-id',
        },
      };

      const response = await deleteMenuItemHandler(event as any, mockContext);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});

