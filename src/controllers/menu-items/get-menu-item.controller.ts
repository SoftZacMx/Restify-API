import { GetMenuItemUseCase } from '../../core/application/use-cases/menu-items/get-menu-item.use-case';
import { makeParamsController } from '../../shared/utils/make-controller';

export const getMenuItemController = makeParamsController(GetMenuItemUseCase);
