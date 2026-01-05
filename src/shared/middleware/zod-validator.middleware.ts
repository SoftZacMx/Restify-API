import { MiddlewareObj } from '@middy/core';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ZodSchema, ZodError } from 'zod';
import { AppError } from '../errors';

interface ZodValidatorOptions {
  schema: ZodSchema;
  eventKey?: 'body' | 'queryStringParameters' | 'pathParameters';
}

/**
 * Middy middleware for Zod validation
 */
export const zodValidator = (options: ZodValidatorOptions): MiddlewareObj => {
  const { schema, eventKey = 'body' } = options;

  const before = async (request: any): Promise<void> => {
    const event = request.event as APIGatewayProxyEvent;
    let dataToValidate: any;

    switch (eventKey) {
      case 'body':
        dataToValidate = event.body;
        break;
      case 'queryStringParameters':
        dataToValidate = event.queryStringParameters || {};
        break;
      case 'pathParameters':
        dataToValidate = event.pathParameters || {};
        break;
      default:
        dataToValidate = event.body;
    }

    try {
      const validated = schema.parse(dataToValidate);
      
      // Store validated data back in the event
      if (eventKey === 'body') {
        request.event.body = validated;
      } else if (eventKey === 'queryStringParameters') {
        request.event.queryStringParameters = validated;
      } else if (eventKey === 'pathParameters') {
        request.event.pathParameters = validated;
      }
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessage = error.errors
          .map((e) => `${e.path.join('.')}: ${e.message}`)
          .join(', ');

        throw new AppError('VALIDATION_ERROR', errorMessage);
      }
      throw error;
    }
  };

  return {
    before,
  };
};

