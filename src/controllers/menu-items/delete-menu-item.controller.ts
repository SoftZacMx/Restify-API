import { DeleteMenuItemUseCase } from '../../core/application/use-cases/menu-items/delete-menu-item.use-case';
import { makeDeleteController } from '../../shared/utils/make-controller';

export const deleteMenuItemController = makeDeleteController(DeleteMenuItemUseCase, 'Menu item deleted successfully');
