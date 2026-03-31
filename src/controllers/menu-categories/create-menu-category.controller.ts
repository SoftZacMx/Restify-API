import { CreateMenuCategoryUseCase } from '../../core/application/use-cases/menu-categories/create-menu-category.use-case';
import { makeBodyController } from '../../shared/utils/make-controller';

export const createMenuCategoryController = makeBodyController(CreateMenuCategoryUseCase);
