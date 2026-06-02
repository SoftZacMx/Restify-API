import { GetMenuCategoryUseCase } from '../../core/application/use-cases/menu-categories/get-menu-category.use-case';
import { makeController } from '../../shared/utils/make-controller';

export const getMenuCategoryController = makeController(GetMenuCategoryUseCase, {
  mapper: (req) => req.params,
});
