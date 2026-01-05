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
import { createTableHandler } from '../../src/handlers/tables/create-table.handler';
import { getTableHandler } from '../../src/handlers/tables/get-table.handler';
import { listTablesHandler } from '../../src/handlers/tables/list-tables.handler';
import { updateTableHandler } from '../../src/handlers/tables/update-table.handler';
import { deleteTableHandler } from '../../src/handlers/tables/delete-table.handler';

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

describe('Tables E2E Tests', () => {
  let createdTableId: string;
  let duplicateTestTableId: string;
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

  describe('Create Table Handler', () => {
    it('should create a table successfully', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const tableNumber = 80000 + (testTimestamp % 10000); // Use timestamp to generate unique table number
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        path: '/api/tables',
        body: JSON.stringify({
          numberTable: tableNumber,
          status: true,
          availabilityStatus: true,
          userId: userId,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const response = await createTableHandler(event as any, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('id');
      expect(body.data.numberTable).toBe(tableNumber);
      expect(body.data.status).toBe(true);
      expect(body.data.availabilityStatus).toBe(true);

      createdTableId = body.data.id;
    });

    it('should return validation error for duplicate table number', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      // First create a table
      const duplicateTableNumber = 80001 + (testTimestamp % 10000);
      const createEvent: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        path: '/api/tables',
        body: JSON.stringify({
          numberTable: duplicateTableNumber,
          status: true,
          availabilityStatus: true,
          userId: userId,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };
      const createResponse = await createTableHandler(createEvent as any, mockContext);
      const createBody = JSON.parse(createResponse.body);
      duplicateTestTableId = createBody.data.id;
      
      // Now try to create another with the same number
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        path: '/api/tables',
        body: JSON.stringify({
          numberTable: duplicateTableNumber,
          status: true,
          availabilityStatus: true,
          userId: userId,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const response = await createTableHandler(event as any, mockContext);

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
        path: '/api/tables',
        body: JSON.stringify({
          numberTable: 101,
          status: true,
          availabilityStatus: true,
          userId: 'invalid-uuid',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const response = await createTableHandler(event as any, mockContext);

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
        path: '/api/tables',
        body: JSON.stringify({
          numberTable: 102,
          status: true,
          availabilityStatus: true,
          userId: '550e8400-e29b-41d4-a716-446655440000',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const response = await createTableHandler(event as any, mockContext);

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('USER_NOT_FOUND');
    });
  });

  describe('Get Table Handler', () => {
    it('should get table by ID successfully', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: `/api/tables/${createdTableId}`,
        pathParameters: {
          table_id: createdTableId,
        },
      };

      const response = await getTableHandler(event as any, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(createdTableId);
      expect(body.data.numberTable).toBeGreaterThan(80000);
    });

    it('should return error for non-existent table', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: '/api/tables/550e8400-e29b-41d4-a716-446655440000',
        pathParameters: {
          table_id: '550e8400-e29b-41d4-a716-446655440000',
        },
      };

      const response = await getTableHandler(event as any, mockContext);

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('TABLE_NOT_FOUND');
    });

    it('should return validation error for invalid UUID', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: '/api/tables/invalid-id',
        pathParameters: {
          table_id: 'invalid-id',
        },
      };

      const response = await getTableHandler(event as any, mockContext);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('List Tables Handler', () => {
    it('should list all tables successfully', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: '/api/tables',
        queryStringParameters: null,
      };

      const response = await listTablesHandler(event as any, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeGreaterThan(0);
    });

    it('should filter tables by status', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: '/api/tables',
        queryStringParameters: {
          status: 'true',
        },
      };

      const response = await listTablesHandler(event as any, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      body.data.forEach((table: any) => {
        expect(table.status).toBe(true);
      });
    });

    it('should filter tables by availabilityStatus', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: '/api/tables',
        queryStringParameters: {
          availabilityStatus: 'true',
        },
      };

      const response = await listTablesHandler(event as any, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      body.data.forEach((table: any) => {
        expect(table.availabilityStatus).toBe(true);
      });
    });
  });

  describe('Update Table Handler', () => {
    it('should update table successfully', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'PUT',
        path: `/api/tables/${createdTableId}`,
        pathParameters: {
          table_id: createdTableId,
        },
        body: JSON.stringify({
          status: false,
          availabilityStatus: false,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const response = await updateTableHandler(event as any, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe(false);
      expect(body.data.availabilityStatus).toBe(false);
    });

    it('should return error for non-existent table', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'PUT',
        path: '/api/tables/550e8400-e29b-41d4-a716-446655440000',
        pathParameters: {
          table_id: '550e8400-e29b-41d4-a716-446655440000',
        },
        body: JSON.stringify({
          status: false,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const response = await updateTableHandler(event as any, mockContext);

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('TABLE_NOT_FOUND');
    });
  });

  describe('Delete Table Handler', () => {
    it('should delete table successfully', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      // Create a table to delete
      const createEvent: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        path: '/api/tables',
        body: JSON.stringify({
          numberTable: 200,
          status: true,
          availabilityStatus: true,
          userId: userId,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const createResponse = await createTableHandler(createEvent as any, mockContext);
      const createBody = JSON.parse(createResponse.body);
      const tableIdToDelete = createBody.data.id;

      // Delete the table
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'DELETE',
        path: `/api/tables/${tableIdToDelete}`,
        pathParameters: {
          table_id: tableIdToDelete,
        },
      };

      const response = await deleteTableHandler(event as any, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.message).toBe('Table deleted successfully');

      // Verify table is deleted
      const getEvent: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: `/api/tables/${tableIdToDelete}`,
        pathParameters: {
          table_id: tableIdToDelete,
        },
      };

      const getResponse = await getTableHandler(getEvent as any, mockContext);
      expect(getResponse.statusCode).toBe(404);
    });

    it('should return error for non-existent table', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'DELETE',
        path: '/api/tables/550e8400-e29b-41d4-a716-446655440000',
        pathParameters: {
          table_id: '550e8400-e29b-41d4-a716-446655440000',
        },
      };

      const response = await deleteTableHandler(event as any, mockContext);

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('TABLE_NOT_FOUND');
    });

    it('should return validation error for invalid UUID', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'DELETE',
        path: '/api/tables/invalid-id',
        pathParameters: {
          table_id: 'invalid-id',
        },
      };

      const response = await deleteTableHandler(event as any, mockContext);

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

      // Clean up tables (delete orders first if they exist)
      if (duplicateTestTableId) {
        await prisma.order.deleteMany({ where: { tableId: duplicateTestTableId } });
        await prisma.table.deleteMany({ where: { id: duplicateTestTableId } });
      }
      if (createdTableId) {
        await prisma.order.deleteMany({ where: { tableId: createdTableId } });
        await prisma.table.deleteMany({ where: { id: createdTableId } });
      }

      await prisma.$disconnect();
    } catch (error) {
      console.error('Error cleaning up test data:', error);
    }
  });
});

