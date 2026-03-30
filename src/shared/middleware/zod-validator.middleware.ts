import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { AppError } from '../errors';

type ValidationSource = 'body' | 'query' | 'params';

interface ZodValidatorOptions {
  schema: ZodSchema;
  source?: ValidationSource;
}

/**
 * Express middleware for Zod validation
 */
export const zodValidator = (options: ZodValidatorOptions) => {
  const { schema, source = 'body' } = options;

  return (req: Request, _res: Response, next: NextFunction): void => {
    const dataToValidate = req[source] || {};

    try {
      const validated = schema.parse(dataToValidate);
      req[source] = validated;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessage = error.errors
          .map((e) => `${e.path.join('.')}: ${e.message}`)
          .join(', ');

        next(new AppError('VALIDATION_ERROR', errorMessage));
        return;
      }
      next(error);
    }
  };
};
