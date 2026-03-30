import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { CreateMenuItemUseCase } from '../../core/application/use-cases/menu-items/create-menu-item.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const createMenuItemController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Body is already parsed and validated by middlewares
    const validatedData = req.body;

    // Execute use case
    const createMenuItemUseCase = container.resolve(CreateMenuItemUseCase);
    const result = await createMenuItemUseCase.execute(validatedData);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
