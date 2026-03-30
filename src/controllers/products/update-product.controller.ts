import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { UpdateProductUseCase } from '../../core/application/use-cases/products/update-product.use-case';
import { updateProductSchema } from '../../core/application/dto/product.dto';
import { AppError } from '../../shared/errors';
import { ZodError } from 'zod';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const updateProductController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const product_id = req.params.product_id;

    if (!product_id) {
      throw new AppError('MISSING_REQUIRED_FIELD', 'Product ID is required');
    }

    // Body is already parsed by middleware
    const bodyData = req.body || {};

    // Validate body data
    let validatedBody;
    try {
      validatedBody = updateProductSchema.parse(bodyData);
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessage = error.errors
          .map((e) => `${e.path.join('.')}: ${e.message}`)
          .join(', ');
        throw new AppError('VALIDATION_ERROR', errorMessage);
      }
      throw error;
    }

    // Execute use case
    const updateProductUseCase = container.resolve(UpdateProductUseCase);
    const result = await updateProductUseCase.execute(product_id, validatedBody);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
