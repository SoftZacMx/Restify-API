import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { DeleteMenuItemUseCase } from '../../core/application/use-cases/menu-items/delete-menu-item.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const deleteMenuItemController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Path parameters are already validated by middleware
    const menu_item_id = req.params.menu_item_id;

    // Execute use case
    const deleteMenuItemUseCase = container.resolve(DeleteMenuItemUseCase);
    await deleteMenuItemUseCase.execute({ menu_item_id });

    sendSuccess(res, { message: 'Menu item deleted successfully' });
  } catch (error) {
    next(error);
  }
};
