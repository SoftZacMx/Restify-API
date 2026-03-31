import { ListMenuItemsUseCase } from '../../core/application/use-cases/menu-items/list-menu-items.use-case';
import { makeQueryController } from '../../shared/utils/make-controller';

export const listMenuItemsController = makeQueryController(ListMenuItemsUseCase);
