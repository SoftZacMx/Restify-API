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
import { generateReportHandler } from '../../src/handlers/reports';
import { ReportType } from '../../src/core/domain/interfaces/report-generator.interface';

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

describe('Reports E2E Tests', () => {
  // Skip if DATABASE_URL is not set or points to test database
  const shouldSkip =
    !process.env.DATABASE_URL || process.env.DATABASE_URL.includes('test');

  describe('Generate Cash Flow Report', () => {
    it('should generate cash flow report successfully', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }

      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: '/api/reports',
        queryStringParameters: {
          type: ReportType.CASH_FLOW,
          dateFrom: '2024-01-01',
          dateTo: '2024-01-31',
        },
        headers: {},
      };

      const response = await generateReportHandler(event as any, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.type).toBe(ReportType.CASH_FLOW);
      expect(body.data.data).toBeDefined();
      expect(body.data.data.incomes).toBeDefined();
      expect(body.data.data.expenses).toBeDefined();
      expect(body.data.data.cashFlow).toBeDefined();
    });

    it('should return validation error for invalid report type', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }

      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: '/api/reports',
        queryStringParameters: {
          type: 'INVALID_TYPE',
        },
        headers: {},
      };

      const response = await generateReportHandler(event as any, mockContext);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });
  });

  describe('Generate Sales Performance Report', () => {
    it('should generate sales performance report successfully', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }

      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: '/api/reports',
        queryStringParameters: {
          type: ReportType.SALES_PERFORMANCE,
          dateFrom: '2024-01-01',
          dateTo: '2024-01-31',
        },
        headers: {},
      };

      const response = await generateReportHandler(event as any, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.type).toBe(ReportType.SALES_PERFORMANCE);
      expect(body.data.data).toBeDefined();
      expect(body.data.data.sales).toBeDefined();
      expect(body.data.data.summary).toBeDefined();
    });
  });

  describe('Generate Expense Analysis Report', () => {
    it('should generate expense analysis report successfully', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }

      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: '/api/reports',
        queryStringParameters: {
          type: ReportType.EXPENSE_ANALYSIS,
          dateFrom: '2024-01-01',
          dateTo: '2024-01-31',
        },
        headers: {},
      };

      const response = await generateReportHandler(event as any, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.type).toBe(ReportType.EXPENSE_ANALYSIS);
      expect(body.data.data).toBeDefined();
      expect(body.data.data.expensesByCategory).toBeDefined();
      expect(body.data.data.employeeSalaries).toBeDefined();
      expect(body.data.data.summary).toBeDefined();
    });
  });

  describe('Report Filters', () => {
    it('should handle date range filters correctly', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }

      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: '/api/reports',
        queryStringParameters: {
          type: ReportType.CASH_FLOW,
          dateFrom: '2024-06-01',
          dateTo: '2024-06-30',
        },
        headers: {},
      };

      const response = await generateReportHandler(event as any, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it('should work without date filters', async () => {
      if (shouldSkip) {
        console.log('⚠️  Skipping E2E test: DATABASE_URL not configured');
        return;
      }

      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: '/api/reports',
        queryStringParameters: {
          type: ReportType.CASH_FLOW,
        },
        headers: {},
      };

      const response = await generateReportHandler(event as any, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });
  });
});

