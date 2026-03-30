import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { UpdateMenuCategoryUseCase } from '../../core/application/use-cases/menu-categories/update-menu-category.use-case';
import { updateMenuCategorySchema } from '../../core/application/dto/menu-category.dto';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';
import { AppError } from '../../shared/errors';
import { ZodError } from 'zod';

export const updateMenuCategoryController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const category_id = req.params.category_id;

    if (!category_id) {
      throw new AppError('MISSING_REQUIRED_FIELD', 'Category ID is required');
    }

    // Body is already parsed by Express
    const bodyData = req.body || {};

    // Validate body data
    let validatedBody;
    try {
      validatedBody = updateMenuCategorySchema.parse(bodyData);
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
    const updateMenuCategoryUseCase = container.resolve(UpdateMenuCategoryUseCase);
    const result = await updateMenuCategoryUseCase.execute(category_id, validatedBody);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
