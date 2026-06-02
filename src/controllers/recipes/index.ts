import { Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { AuthenticatedRequest } from '../../server/middleware/auth.middleware';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';
import { GetRecipeUseCase } from '../../core/application/use-cases/recipes/get-recipe.use-case';
import { ReplaceRecipeUseCase } from '../../core/application/use-cases/recipes/replace-recipe.use-case';
import { AddRecipeItemUseCase } from '../../core/application/use-cases/recipes/add-recipe-item.use-case';
import { UpdateRecipeItemUseCase } from '../../core/application/use-cases/recipes/update-recipe-item.use-case';
import { RemoveRecipeItemUseCase } from '../../core/application/use-cases/recipes/remove-recipe-item.use-case';

export const getRecipeController = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const useCase = container.resolve(GetRecipeUseCase);
    const result = await useCase.execute(req.params.menu_item_id);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export const replaceRecipeController = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const useCase = container.resolve(ReplaceRecipeUseCase);
    const result = await useCase.execute(req.params.menu_item_id, req.body);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export const addRecipeItemController = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const useCase = container.resolve(AddRecipeItemUseCase);
    const result = await useCase.execute(req.params.menu_item_id, req.body);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export const updateRecipeItemController = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const useCase = container.resolve(UpdateRecipeItemUseCase);
    const result = await useCase.execute(req.params.menu_item_id, req.params.product_id, req.body);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export const removeRecipeItemController = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const useCase = container.resolve(RemoveRecipeItemUseCase);
    await useCase.execute(req.params.menu_item_id, req.params.product_id);
    sendSuccess(res, { message: 'Ingredient removed' });
  } catch (error) {
    next(error);
  }
};
