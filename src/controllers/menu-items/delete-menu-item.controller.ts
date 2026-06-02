import { DeleteMenuItemUseCase } from '../../core/application/use-cases/menu-items/delete-menu-item.use-case';
import { makeController } from '../../shared/utils/make-controller';

export const deleteMenuItemController = makeController(DeleteMenuItemUseCase, {
  mapper: (req) => req.params,
  responseMapper: () => ({ message: 'Menu item deleted successfully' }),
});
