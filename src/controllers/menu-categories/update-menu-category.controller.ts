import { UpdateMenuCategoryUseCase } from '../../core/application/use-cases/menu-categories/update-menu-category.use-case';
import { makeController } from '../../shared/utils/make-controller';

export const updateMenuCategoryController = makeController(UpdateMenuCategoryUseCase, {
  mapper: (req) => [req.params.category_id, req.body],
});
