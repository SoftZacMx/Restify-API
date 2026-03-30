import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { GetMenuItemUseCase } from '../../core/application/use-cases/menu-items/get-menu-item.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const getMenuItemController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Path parameters are already validated by middleware
    const menu_item_id = req.params.menu_item_id;

    // Execute use case
    const getMenuItemUseCase = container.resolve(GetMenuItemUseCase);
    const result = await getMenuItemUseCase.execute({ menu_item_id });

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
