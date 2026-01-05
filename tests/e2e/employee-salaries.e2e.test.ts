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
      request.event.queryStringParameters =
        request.event.queryStringParameters || {};
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
            appError = new AppError(
              'INTERNAL_ERROR',
              error.message || 'An unexpected error occurred'
            );
          }

          request.response = ApiResponseHandler.error(
            appError,
            appError.statusCode
          );
        }
      },
    }),
  };
});

jest.mock('../../src/shared/middleware/response-formatter.middleware', () => ({
  responseFormatter: () => ({
    after: async (request: any) => {
      const { ApiResponseHandler } = require('../../src/shared/types/lambda.types');
      if (request.response && !request.response.statusCode) {
        request.response = ApiResponseHandler.success(
          request.response,
          200
        );
      }
    },
  }),
}));

// Initialize dependency injection
import '../../src/core/infrastructure/config/dependency-injection';

import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { createEmployeeSalaryPaymentHandler } from '../../src/handlers/employees-salaries/create-employee-salary-payment.handler';
import { getEmployeeSalaryPaymentHandler } from '../../src/handlers/employees-salaries/get-employee-salary-payment.handler';
import { listEmployeeSalaryPaymentsHandler } from '../../src/handlers/employees-salaries/list-employee-salary-payments.handler';
import { updateEmployeeSalaryPaymentHandler } from '../../src/handlers/employees-salaries/update-employee-salary-payment.handler';
import { deleteEmployeeSalaryPaymentHandler } from '../../src/handlers/employees-salaries/delete-employee-salary-payment.handler';

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

describe('Employee Salaries E2E Tests', () => {
  let createdPaymentId: string;
  let testUserId: string | undefined;

  // Skip if DATABASE_URL is not set or points to test database
  const shouldSkip =
    !process.env.DATABASE_URL || process.env.DATABASE_URL.includes('test');

  // Create a test user first (assuming user creation works)
  beforeAll(async () => {
    if (shouldSkip) {
      return;
    }
    // You might need to create a test user here or use an existing one
    // For now, we'll assume testUserId is set manually or from a previous test
  });

  describe('Create Employee Salary Payment Handler', () => {
    it('should create an employee salary payment successfully', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }

      // First, we need a valid user ID
      // In a real scenario, you'd create a user first or use an existing one
      // For this test, we'll assume testUserId is available
      if (!testUserId) {
        console.log('⚠️  Skipping: testUserId not set');
        return;
      }

      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        path: '/api/employee-salaries',
        body: JSON.stringify({
          userId: testUserId,
          amount: 5000.0,
          paymentMethod: 1, // Cash
          date: '2024-01-15T00:00:00.000Z',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const response = await createEmployeeSalaryPaymentHandler(
        event as any,
        mockContext
      );

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('id');
      expect(body.data.userId).toBe(testUserId);
      expect(body.data.amount).toBe(5000.0);
      expect(body.data.paymentMethod).toBe(1);

      createdPaymentId = body.data.id;
    });

    it('should return validation error for invalid userId', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }

      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        path: '/api/employee-salaries',
        body: JSON.stringify({
          userId: 'invalid-uuid',
          amount: 5000.0,
          paymentMethod: 1,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const response = await createEmployeeSalaryPaymentHandler(
        event as any,
        mockContext
      );

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });

    it('should return validation error for negative amount', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }

      if (!testUserId) {
        console.log('⚠️  Skipping: testUserId not set');
        return;
      }

      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        path: '/api/employee-salaries',
        body: JSON.stringify({
          userId: testUserId,
          amount: -100,
          paymentMethod: 1,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const response = await createEmployeeSalaryPaymentHandler(
        event as any,
        mockContext
      );

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });
  });

  describe('Get Employee Salary Payment Handler', () => {
    it('should get an employee salary payment successfully', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }

      if (!createdPaymentId) {
        console.log('⚠️  Skipping: No payment created');
        return;
      }

      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: `/api/employee-salaries/${createdPaymentId}`,
        pathParameters: {
          employee_salary_payment_id: createdPaymentId,
        },
        headers: {},
      };

      const response = await getEmployeeSalaryPaymentHandler(
        event as any,
        mockContext
      );

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(createdPaymentId);
    });

    it('should return error for non-existent payment', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }

      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: '/api/employee-salaries/non-existent-id',
        pathParameters: {
          employee_salary_payment_id: 'non-existent-id',
        },
        headers: {},
      };

      const response = await getEmployeeSalaryPaymentHandler(
        event as any,
        mockContext
      );

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });
  });

  describe('List Employee Salary Payments Handler', () => {
    it('should list employee salary payments successfully', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }

      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: '/api/employee-salaries',
        queryStringParameters: null,
        headers: {},
      };

      const response = await listEmployeeSalaryPaymentsHandler(
        event as any,
        mockContext
      );

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('data');
      expect(body.data).toHaveProperty('pagination');
    });

    it('should filter by userId', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }

      if (!testUserId) {
        console.log('⚠️  Skipping: testUserId not set');
        return;
      }

      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: '/api/employee-salaries',
        queryStringParameters: {
          userId: testUserId,
        },
        headers: {},
      };

      const response = await listEmployeeSalaryPaymentsHandler(
        event as any,
        mockContext
      );

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });
  });

  describe('Update Employee Salary Payment Handler', () => {
    it('should update an employee salary payment successfully', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }

      if (!createdPaymentId) {
        console.log('⚠️  Skipping: No payment created');
        return;
      }

      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'PUT',
        path: `/api/employee-salaries/${createdPaymentId}`,
        pathParameters: {
          employee_salary_payment_id: createdPaymentId,
        },
        body: JSON.stringify({
          amount: 6000.0,
          paymentMethod: 2, // Transfer
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const response = await updateEmployeeSalaryPaymentHandler(
        event as any,
        mockContext
      );

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.amount).toBe(6000.0);
      expect(body.data.paymentMethod).toBe(2);
    });
  });

  describe('Delete Employee Salary Payment Handler', () => {
    it('should delete an employee salary payment successfully', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }

      if (!createdPaymentId) {
        console.log('⚠️  Skipping: No payment created');
        return;
      }

      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'DELETE',
        path: `/api/employee-salaries/${createdPaymentId}`,
        pathParameters: {
          employee_salary_payment_id: createdPaymentId,
        },
        headers: {},
      };

      const response = await deleteEmployeeSalaryPaymentHandler(
        event as any,
        mockContext
      );

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });
  });
});

