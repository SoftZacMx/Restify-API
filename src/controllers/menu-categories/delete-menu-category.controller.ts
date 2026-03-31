import { DeleteMenuCategoryUseCase } from '../../core/application/use-cases/menu-categories/delete-menu-category.use-case';
import { makeDeleteController } from '../../shared/utils/make-controller';

export const deleteMenuCategoryController = makeDeleteController(DeleteMenuCategoryUseCase, 'Menu category deleted successfully');
