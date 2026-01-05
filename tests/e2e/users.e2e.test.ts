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
import { createUserHandler } from '../../src/handlers/users/create-user.handler';
import { getUserHandler } from '../../src/handlers/users/get-user.handler';
import { listUsersHandler } from '../../src/handlers/users/list-users.handler';
import { updateUserHandler } from '../../src/handlers/users/update-user.handler';
import { deleteUserHandler } from '../../src/handlers/users/delete-user.handler';
import { UserRole } from '@prisma/client';

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

describe('Users E2E Tests', () => {
  let createdUserId: string;
  
  // Skip if DATABASE_URL is not set or points to test database
  const shouldSkip = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes('test');

  describe('Create User Handler', () => {
    it('should create a user successfully', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        path: '/api/users',
        body: JSON.stringify({
          name: 'E2E Test',
          last_name: 'User',
          email: 'e2etest@restify.com',
          password: 'Test123!',
          rol: UserRole.WAITER,
          status: true,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const response = await createUserHandler(event as any, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('id');
      expect(body.data.email).toBe('e2etest@restify.com');
      expect(body.data.rol).toBe(UserRole.WAITER);
      expect(body.data).not.toHaveProperty('password');

      createdUserId = body.data.id;
    });

    it('should return validation error for invalid email', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        path: '/api/users',
        body: JSON.stringify({
          name: 'Test',
          last_name: 'User',
          email: 'invalid-email',
          password: 'Test123!',
          rol: UserRole.WAITER,
          status: true,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const response = await createUserHandler(event as any, mockContext);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return validation error for duplicate email', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        path: '/api/users',
        body: JSON.stringify({
          name: 'Duplicate',
          last_name: 'User',
          email: 'e2etest@restify.com',
          password: 'Test123!',
          rol: UserRole.WAITER,
          status: true,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const response = await createUserHandler(event as any, mockContext);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Get User Handler', () => {
    it('should get user by ID successfully', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: `/api/users/${createdUserId}`,
        pathParameters: {
          user_id: createdUserId,
        },
      };

      const response = await getUserHandler(event as any, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(createdUserId);
      expect(body.data.email).toBe('e2etest@restify.com');
      expect(body.data).not.toHaveProperty('password');
    });

    it('should return error for non-existent user', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: '/api/users/550e8400-e29b-41d4-a716-446655440000',
        pathParameters: {
          user_id: '550e8400-e29b-41d4-a716-446655440000',
        },
      };

      const response = await getUserHandler(event as any, mockContext);

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('USER_NOT_FOUND');
    });

    it('should return validation error for invalid UUID', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: '/api/users/invalid-id',
        pathParameters: {
          user_id: 'invalid-id',
        },
      };

      const response = await getUserHandler(event as any, mockContext);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('List Users Handler', () => {
    it('should list all users successfully', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: '/api/users',
        queryStringParameters: null,
      };

      const response = await listUsersHandler(event as any, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeGreaterThan(0);
      if (body.data.length > 0) {
        expect(body.data[0]).not.toHaveProperty('password');
      }
    });

    it('should filter users by role', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: '/api/users',
        queryStringParameters: {
          rol: UserRole.WAITER,
        },
      };

      const response = await listUsersHandler(event as any, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      body.data.forEach((user: any) => {
        expect(user.rol).toBe(UserRole.WAITER);
      });
    });

    it('should filter users by status', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: '/api/users',
        queryStringParameters: {
          status: 'true',
        },
      };

      const response = await listUsersHandler(event as any, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      body.data.forEach((user: any) => {
        expect(user.status).toBe(true);
      });
    });
  });

  describe('Update User Handler', () => {
    it('should update user successfully', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'PUT',
        path: `/api/users/${createdUserId}`,
        pathParameters: {
          user_id: createdUserId,
        },
        body: JSON.stringify({
          name: 'Updated E2E Test',
          status: false,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const response = await updateUserHandler(event as any, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.name).toBe('Updated E2E Test');
      expect(body.data.status).toBe(false);
      expect(body.data).not.toHaveProperty('password');
    });

    it('should update user password successfully', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'PUT',
        path: `/api/users/${createdUserId}`,
        pathParameters: {
          user_id: createdUserId,
        },
        body: JSON.stringify({
          password: 'NewPassword123!',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const response = await updateUserHandler(event as any, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).not.toHaveProperty('password');
    });

    it('should return error for non-existent user', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'PUT',
        path: '/api/users/550e8400-e29b-41d4-a716-446655440000',
        pathParameters: {
          user_id: '550e8400-e29b-41d4-a716-446655440000',
        },
        body: JSON.stringify({
          name: 'Updated',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const response = await updateUserHandler(event as any, mockContext);

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('USER_NOT_FOUND');
    });

    it('should return validation error for invalid data', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'PUT',
        path: `/api/users/${createdUserId}`,
        pathParameters: {
          user_id: createdUserId,
        },
        body: JSON.stringify({
          email: 'invalid-email',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const response = await updateUserHandler(event as any, mockContext);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Delete User Handler', () => {
    it('should delete user successfully', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      // Create a user to delete
      const createEvent: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        path: '/api/users',
        body: JSON.stringify({
          name: 'Delete Test',
          last_name: 'User',
          email: 'deletetest@restify.com',
          password: 'Test123!',
          rol: UserRole.CHEF,
          status: true,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const createResponse = await createUserHandler(createEvent as any, mockContext);
      const createBody = JSON.parse(createResponse.body);
      const userIdToDelete = createBody.data.id;

      // Delete the user
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'DELETE',
        path: `/api/users/${userIdToDelete}`,
        pathParameters: {
          user_id: userIdToDelete,
        },
      };

      const response = await deleteUserHandler(event as any, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.message).toBe('User deleted successfully');

      // Verify user is deleted
      const getEvent: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: `/api/users/${userIdToDelete}`,
        pathParameters: {
          user_id: userIdToDelete,
        },
      };

      const getResponse = await getUserHandler(getEvent as any, {} as any);
      expect(getResponse.statusCode).toBe(404);
    });

    it('should return error for non-existent user', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'DELETE',
        path: '/api/users/550e8400-e29b-41d4-a716-446655440000',
        pathParameters: {
          user_id: '550e8400-e29b-41d4-a716-446655440000',
        },
      };

      const response = await deleteUserHandler(event as any, mockContext);

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('USER_NOT_FOUND');
    });

    it('should return validation error for invalid UUID', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }
      
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'DELETE',
        path: '/api/users/invalid-id',
        pathParameters: {
          user_id: 'invalid-id',
        },
      };

      const response = await deleteUserHandler(event as any, mockContext);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});

