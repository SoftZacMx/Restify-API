import { GetMenuItemUseCase } from '../../core/application/use-cases/menu-items/get-menu-item.use-case';
import { makeController } from '../../shared/utils/make-controller';

export const getMenuItemController = makeController(GetMenuItemUseCase, {
  mapper: (req) => req.params,
});
