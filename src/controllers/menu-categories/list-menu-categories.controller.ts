import { ListMenuCategoriesUseCase } from '../../core/application/use-cases/menu-categories/list-menu-categories.use-case';
import { makeController } from '../../shared/utils/make-controller';

export const listMenuCategoriesController = makeController(ListMenuCategoriesUseCase, {
  mapper: (req) => req.query,
});
