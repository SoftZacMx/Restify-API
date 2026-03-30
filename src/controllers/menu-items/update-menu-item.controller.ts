import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { UpdateMenuItemUseCase } from '../../core/application/use-cases/menu-items/update-menu-item.use-case';
import { updateMenuItemSchema } from '../../core/application/dto/menu-item.dto';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';
import { AppError } from '../../shared/errors';
import { ZodError } from 'zod';

export const updateMenuItemController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const menu_item_id = req.params.menu_item_id;

    if (!menu_item_id) {
      throw new AppError('MISSING_REQUIRED_FIELD', 'Menu item ID is required');
    }

    // Body is already parsed by Express
    const bodyData = req.body || {};

    // Validate body data
    let validatedBody;
    try {
      validatedBody = updateMenuItemSchema.parse(bodyData);
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
    const updateMenuItemUseCase = container.resolve(UpdateMenuItemUseCase);
    const result = await updateMenuItemUseCase.execute(menu_item_id, validatedBody);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
