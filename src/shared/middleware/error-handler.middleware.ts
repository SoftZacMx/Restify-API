import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/app-error';
import { ERROR_CONFIG, ErrorCode } from '../errors/error-config';
import { ZodError } from 'zod';

/**
 * Express global error handler middleware
 */
export const expressErrorHandler = (
  error: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let appError: AppError;

  if (error instanceof AppError) {
    appError = error;
  } else {
    appError = convertToAppError(error);
  }

  console.error('Handler error:', {
    code: appError.code,
    message: appError.message,
    category: appError.category,
    statusCode: appError.statusCode,
    path: req.path,
    method: req.method,
    stack:
      process.env.NODE_ENV === 'development' && error?.stack
        ? error.stack
        : undefined,
  });

  res.status(appError.statusCode).json({
    success: false,
    error: {
      code: appError.code,
      message: appError.message,
    },
    timestamp: new Date().toISOString(),
  });
};

/**
 * Converts various error types to AppError
 */
function convertToAppError(error: any): AppError {
  if (error instanceof ZodError) {
    const errorMessage = error.errors
      .map((e) => `${e.path.join('.')}: ${e.message}`)
      .join(', ');
    return new AppError('VALIDATION_ERROR', errorMessage);
  }

  if (typeof error === 'string') {
    return mapStringToAppError(error);
  }

  if (error instanceof Error) {
    return mapErrorToAppError(error);
  }

  if (error && typeof error === 'object') {
    if (error.code && ERROR_CONFIG[error.code as ErrorCode]) {
      return new AppError(
        error.code as ErrorCode,
        error.message,
        error.metadata
      );
    }
    return mapErrorToAppError(error);
  }

  return new AppError('INTERNAL_ERROR', 'An unexpected error occurred');
}

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

function mapErrorToAppError(error: Error | any): AppError {
  const message = error.message || String(error) || 'An error occurred';
  return mapStringToAppError(message);
}
