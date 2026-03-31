import { GetMenuCategoryUseCase } from '../../core/application/use-cases/menu-categories/get-menu-category.use-case';
import { makeParamsController } from '../../shared/utils/make-controller';

export const getMenuCategoryController = makeParamsController(GetMenuCategoryUseCase);
