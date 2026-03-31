import { UpdateMenuCategoryUseCase } from '../../core/application/use-cases/menu-categories/update-menu-category.use-case';
import { makeParamBodyController } from '../../shared/utils/make-controller';

export const updateMenuCategoryController = makeParamBodyController(UpdateMenuCategoryUseCase, 'category_id');
