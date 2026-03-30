import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { CreateMenuCategoryUseCase } from '../../core/application/use-cases/menu-categories/create-menu-category.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const createMenuCategoryController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Body is already parsed and validated by middlewares
    const validatedData = req.body;

    // Execute use case
    const createMenuCategoryUseCase = container.resolve(CreateMenuCategoryUseCase);
    const result = await createMenuCategoryUseCase.execute(validatedData);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
