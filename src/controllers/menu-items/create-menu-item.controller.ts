import { CreateMenuItemUseCase } from '../../core/application/use-cases/menu-items/create-menu-item.use-case';
import { makeController } from '../../shared/utils/make-controller';

export const createMenuItemController = makeController(CreateMenuItemUseCase);
