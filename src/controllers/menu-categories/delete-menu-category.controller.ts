import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { DeleteMenuCategoryUseCase } from '../../core/application/use-cases/menu-categories/delete-menu-category.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const deleteMenuCategoryController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Path parameters are already validated by middleware
    const category_id = req.params.category_id;

    // Execute use case
    const deleteMenuCategoryUseCase = container.resolve(DeleteMenuCategoryUseCase);
    await deleteMenuCategoryUseCase.execute({ category_id });

    sendSuccess(res, { message: 'Menu category deleted successfully' });
  } catch (error) {
    next(error);
  }
};
