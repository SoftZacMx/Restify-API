import { ListMenuItemsUseCase } from '../../core/application/use-cases/menu-items/list-menu-items.use-case';
import { makeController } from '../../shared/utils/make-controller';

export const listMenuItemsController = makeController(ListMenuItemsUseCase, {
  mapper: (req) => req.query,
});
