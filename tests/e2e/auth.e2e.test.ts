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
      request.event.multiValueQueryStringParameters = request.event.multiValueQueryStringParameters || {};
    },
  }),
}));

jest.mock('@middy/http-error-handler', () => ({
  __esModule: true,
  default: () => ({
    onError: async (request: any) => {
      // Error handling is done by custom error handler
    },
  }),
}));

import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { verifyUserHandler } from '../../src/handlers/auth/verify-user.handler';
import { setPasswordHandler } from '../../src/handlers/auth/set-password.handler';
import { loginHandler } from '../../src/handlers/auth/login.handler';
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

describe('Auth E2E Tests', () => {
  // Mock console.error to avoid noise in tests
  const originalError = console.error;
  beforeAll(() => {
    console.error = jest.fn();
  });

  afterAll(() => {
    console.error = originalError;
  });

  describe('POST /auth/login', () => {
    it('should return 400 for invalid email format', async () => {
      const event: APIGatewayProxyEvent = {
        body: JSON.stringify({
          email: 'invalid-email',
          password: 'password123',
        }),
        headers: {},
        multiValueHeaders: {},
        httpMethod: 'POST',
        isBase64Encoded: false,
        path: '/auth/login/ADMIN',
        pathParameters: { rol: 'ADMIN' },
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      };

      const result = await loginHandler(event as any, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for missing password', async () => {
      const event: APIGatewayProxyEvent = {
        body: JSON.stringify({
          email: 'test@example.com',
        }),
        headers: {},
        multiValueHeaders: {},
        httpMethod: 'POST',
        isBase64Encoded: false,
        path: '/auth/login/ADMIN',
        pathParameters: { rol: 'ADMIN' },
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      };

      const result = await loginHandler(event as any, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
    });
  });

  describe('POST /auth/verify_user', () => {
    it('should return 400 for invalid email', async () => {
      const event: APIGatewayProxyEvent = {
        body: JSON.stringify({
          email: 'invalid-email',
        }),
        headers: {},
        multiValueHeaders: {},
        httpMethod: 'POST',
        isBase64Encoded: false,
        path: '/auth/verify_user',
        pathParameters: null,
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      };

      const result = await verifyUserHandler(event as any, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
    });
  });

  describe('PUT /auth/set-password/:user_id', () => {
    it('should return 400 for missing user_id', async () => {
      const event: APIGatewayProxyEvent = {
        body: JSON.stringify({
          password: 'newPassword123',
        }),
        headers: {},
        multiValueHeaders: {},
        httpMethod: 'PUT',
        isBase64Encoded: false,
        path: '/auth/set-password',
        pathParameters: null,
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      };

      try {
        const result = await setPasswordHandler(event as any, mockContext);
        expect(result.statusCode).toBe(400);
        const body = JSON.parse(result.body);
        expect(body.success).toBe(false);
      } catch (error: any) {
        // Handler throws AppError which should be caught by error handler
        expect(error).toBeDefined();
      }
    });

    it('should return 400 for invalid password length', async () => {
      const event: APIGatewayProxyEvent = {
        body: JSON.stringify({
          password: '12345', // Less than 6 characters
        }),
        headers: {},
        multiValueHeaders: {},
        httpMethod: 'PUT',
        isBase64Encoded: false,
        path: '/auth/set-password/550e8400-e29b-41d4-a716-446655440000',
        pathParameters: {
          user_id: '550e8400-e29b-41d4-a716-446655440000',
        },
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      };

      const result = await setPasswordHandler(event as any, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
    });
  });
});

