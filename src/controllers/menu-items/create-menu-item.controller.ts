import { CreateMenuItemUseCase } from '../../core/application/use-cases/menu-items/create-menu-item.use-case';
import { makeBodyController } from '../../shared/utils/make-controller';

export const createMenuItemController = makeBodyController(CreateMenuItemUseCase);
