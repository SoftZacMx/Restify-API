import { MiddlewareObj } from '@middy/core';
import { APIGatewayProxyResult } from 'aws-lambda';
import { ApiResponseHandler } from '../types/lambda.types';

/**
 * Middy middleware to format responses consistently
 * Converts handler return values to APIGatewayProxyResult format
 */
export const responseFormatter = (): MiddlewareObj => {
  const after = async (request: any): Promise<void> => {
    const response = request.response;

    // If response is already an APIGatewayProxyResult, leave it as is
    if (response && typeof response === 'object' && 'statusCode' in response) {
      return;
    }

    // If response is data, wrap it in success format
    if (response !== undefined && response !== null) {
      request.response = ApiResponseHandler.success(response, 200);
    } else {
      request.response = ApiResponseHandler.success({}, 200);
    }
  };

  return {
    after,
  };
};

