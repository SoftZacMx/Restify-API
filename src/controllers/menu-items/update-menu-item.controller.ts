import { UpdateMenuItemUseCase } from '../../core/application/use-cases/menu-items/update-menu-item.use-case';
import { makeController } from '../../shared/utils/make-controller';

export const updateMenuItemController = makeController(UpdateMenuItemUseCase, {
  mapper: (req) => [req.params.menu_item_id, req.body],
});
