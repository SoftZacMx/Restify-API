import { MiddlewareObj } from '@middy/core';
import { ApiResponseHandler } from '../types/lambda.types';
import { AppError } from '../errors/app-error';
import { ERROR_CONFIG, ErrorCode } from '../errors/error-config';
import { ZodError } from 'zod';

/**
 * Custom error handler middleware for Middy
 * Formats errors consistently with ApiResponseHandler
 * Handles AppError instances and converts other errors to AppError
 */
export const customErrorHandler = (): MiddlewareObj => {
  const onError = async (request: any): Promise<void> => {
    const error: any = request.error;

    let appError: AppError;

    // If it's already an AppError, use it directly
    if (error instanceof AppError) {
      appError = error;
    } else {
      // Convert other error types to AppError
      appError = convertToAppError(error);
    }

    // Log error with context
    console.error('Handler error:', {
      code: appError.code,
      message: appError.message,
      category: appError.category,
      statusCode: appError.statusCode,
      metadata: appError.metadata,
      stack:
        process.env.NODE_ENV === 'development' && error?.stack
          ? error.stack
          : undefined,
    });

    // Format error response
    request.response = ApiResponseHandler.error(
      appError.message,
      appError.code,
      appError.statusCode
    );
  };

  return {
    onError,
  };
};

/**
 * Converts various error types to AppError
 */
function convertToAppError(error: any): AppError {
  // Handle ZodError specifically
  if (error instanceof ZodError) {
    const errorMessage = error.errors
      .map((e) => `${e.path.join('.')}: ${e.message}`)
      .join(', ');
    return new AppError('VALIDATION_ERROR', errorMessage);
  }

  // Handle string errors
  if (typeof error === 'string') {
    return mapStringToAppError(error);
  }

  // Handle Error objects
  if (error instanceof Error) {
    return mapErrorToAppError(error);
  }

  // Handle objects with error properties
  if (error && typeof error === 'object') {
    // If it has code and statusCode, try to use it as ErrorCode
    if (error.code && ERROR_CONFIG[error.code as ErrorCode]) {
      return new AppError(
        error.code as ErrorCode,
        error.message,
        error.metadata
      );
    }
    return mapErrorToAppError(error);
  }

  // Unknown error type - default to INTERNAL_ERROR
  return new AppError('INTERNAL_ERROR', 'An unexpected error occurred');
}

/**
 * Maps string error messages to AppError codes
 */
function mapStringToAppError(message: string): AppError {
  const upperMessage = message.toUpperCase();

  if (upperMessage.includes('USER NOT FOUND') || upperMessage.includes('NOT FOUND')) {
    return new AppError('USER_NOT_FOUND', message);
  }
  if (upperMessage.includes('NOT ACTIVE') || upperMessage.includes('INACTIVE')) {
    return new AppError('USER_NOT_ACTIVE', message);
  }
  if (upperMessage.includes('PASSWORD') && upperMessage.includes('INCORRECT')) {
    return new AppError('PASSWORD_INCORRECT', message);
  }
  if (upperMessage.includes('UNAUTHORIZED')) {
    return new AppError('UNAUTHORIZED', message);
  }
  if (upperMessage.includes('FORBIDDEN')) {
    return new AppError('FORBIDDEN', message);
  }
  if (upperMessage.includes('VALIDATION') || upperMessage.includes('INVALID')) {
    return new AppError('VALIDATION_ERROR', message);
  }

  return new AppError('INTERNAL_ERROR', message);
}

/**
 * Maps Error objects to AppError
 */
function mapErrorToAppError(error: Error | any): AppError {
  const message = error.message || String(error) || 'An error occurred';
  return mapStringToAppError(message);
}


