import { ErrorCode, ERROR_CONFIG } from './error-config';

/**
 * Base application error class
 * Provides consistent error handling with codes, status codes, and categories
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly category: string;
  public readonly metadata?: Record<string, any>;
  public readonly timestamp: Date;

  constructor(
    code: ErrorCode,
    customMessage?: string,
    metadata?: Record<string, any>
  ) {
    const config = ERROR_CONFIG[code];
    const message = customMessage || config.message;

    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = config.statusCode;
    this.category = config.category;
    this.metadata = metadata;
    this.timestamp = new Date();

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  /**
   * Static factory method for creating errors
   * Provides a cleaner API: AppError.create('USER_NOT_FOUND')
   */
  static create(
    code: ErrorCode,
    customMessage?: string,
    metadata?: Record<string, any>
  ): AppError {
    return new AppError(code, customMessage, metadata);
  }

  /**
   * Convert error to JSON for logging/API responses
   */
  toJSON(): {
    code: string;
    message: string;
    category: string;
    statusCode: number;
    timestamp: string;
    metadata?: Record<string, any>;
  } {
    return {
      code: this.code,
      message: this.message,
      category: this.category,
      statusCode: this.statusCode,
      timestamp: this.timestamp.toISOString(),
      ...(this.metadata && { metadata: this.metadata }),
    };
  }

  /**
   * Check if error is of a specific category
   */
  isCategory(category: string): boolean {
    return this.category === category;
  }

  /**
   * Check if error is a client error (4xx)
   */
  isClientError(): boolean {
    return this.statusCode >= 400 && this.statusCode < 500;
  }

  /**
   * Check if error is a server error (5xx)
   */
  isServerError(): boolean {
    return this.statusCode >= 500;
  }
}

