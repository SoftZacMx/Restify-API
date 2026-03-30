import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { GetMenuCategoryUseCase } from '../../core/application/use-cases/menu-categories/get-menu-category.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const getMenuCategoryController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Path parameters are already validated by middleware
    const category_id = req.params.category_id;

    // Execute use case
    const getMenuCategoryUseCase = container.resolve(GetMenuCategoryUseCase);
    const result = await getMenuCategoryUseCase.execute({ category_id });

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
