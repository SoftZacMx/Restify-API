import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { ListMenuCategoriesUseCase } from '../../core/application/use-cases/menu-categories/list-menu-categories.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const listMenuCategoriesController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Query parameters are already validated by middleware
    const queryParams = req.query || {};

    // Execute use case
    const listMenuCategoriesUseCase = container.resolve(ListMenuCategoriesUseCase);
    const result = await listMenuCategoriesUseCase.execute(queryParams);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
