import { DeleteMenuCategoryUseCase } from '../../core/application/use-cases/menu-categories/delete-menu-category.use-case';
import { makeController } from '../../shared/utils/make-controller';

export const deleteMenuCategoryController = makeController(DeleteMenuCategoryUseCase, {
  mapper: (req) => req.params,
  responseMapper: () => ({ message: 'Menu category deleted successfully' }),
});
