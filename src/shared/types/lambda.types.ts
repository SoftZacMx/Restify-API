import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';

export interface LambdaHandler {
  (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult>;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  timestamp: string;
}

export class ApiResponseHandler {
  /**
   * Get CORS headers based on environment configuration
   * Note: Express CORS middleware handles CORS headers automatically,
   * but we include them here for Lambda compatibility
   */
  private static getCorsHeaders(): Record<string, string> {
    const isDevelopment = process.env.NODE_ENV !== 'production';
    const allowCredentials = process.env.CORS_CREDENTIALS !== 'false';
    const corsOrigin = process.env.CORS_ORIGIN || (isDevelopment ? 'http://localhost:5173' : '*');
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    };

    // Add credentials header if enabled (and origin is not '*')
    if (allowCredentials && corsOrigin !== '*') {
      headers['Access-Control-Allow-Credentials'] = 'true';
    }

    return headers;
  }

  static success<T>(data: T, statusCode: number = 200): APIGatewayProxyResult {
    return {
      statusCode,
      headers: this.getCorsHeaders(),
      body: JSON.stringify({
        success: true,
        data,
        timestamp: new Date().toISOString(),
      } as ApiResponse<T>),
    };
  }

  static error(
    message: string,
    code: string = 'ERROR',
    statusCode: number = 500
  ): APIGatewayProxyResult {
    return {
      statusCode,
      headers: this.getCorsHeaders(),
      body: JSON.stringify({
        success: false,
        error: {
          code,
          message,
        },
        timestamp: new Date().toISOString(),
      } as ApiResponse),
    };
  }
}

