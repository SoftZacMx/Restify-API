import { ListMenuCategoriesUseCase } from '../../core/application/use-cases/menu-categories/list-menu-categories.use-case';
import { makeQueryController } from '../../shared/utils/make-controller';

export const listMenuCategoriesController = makeQueryController(ListMenuCategoriesUseCase);
