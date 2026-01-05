import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

export class ErrorHandlerMiddleware {
  static handle(error: AppError, req: Request, res: Response, next: NextFunction): void {
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Internal Server Error';
    const code = error.code || 'INTERNAL_ERROR';

    console.error('Error:', {
      message,
      code,
      statusCode,
      path: req.path,
      method: req.method,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });

    res.status(statusCode).json({
      success: false,
      error: {
        code,
        message,
      },
      timestamp: new Date().toISOString(),
    });
  }
}

