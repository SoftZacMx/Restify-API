import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { ListMenuItemsUseCase } from '../../core/application/use-cases/menu-items/list-menu-items.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const listMenuItemsController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Query parameters are already validated by middleware
    const queryParams = req.query || {};

    // Execute use case
    const listMenuItemsUseCase = container.resolve(ListMenuItemsUseCase);
    const result = await listMenuItemsUseCase.execute(queryParams);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
