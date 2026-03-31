import { UpdateMenuItemUseCase } from '../../core/application/use-cases/menu-items/update-menu-item.use-case';
import { makeParamBodyController } from '../../shared/utils/make-controller';

export const updateMenuItemController = makeParamBodyController(UpdateMenuItemUseCase, 'menu_item_id');
