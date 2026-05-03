import { Router } from 'express';
import {
  createMenuItemController,
  getMenuItemController,
  listMenuItemsController,
  updateMenuItemController,
  deleteMenuItemController,
} from '../../controllers/menu-items';
import {
  getRecipeController,
  replaceRecipeController,
  addRecipeItemController,
  updateRecipeItemController,
  removeRecipeItemController,
} from '../../controllers/recipes';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { createMenuItemSchema, getMenuItemSchema, listMenuItemsSchema, updateMenuItemSchema, deleteMenuItemSchema } from '../../core/application/dto/menu-item.dto';
import {
  replaceRecipeSchema,
  addRecipeItemSchema,
  updateRecipeItemSchema,
} from '../../core/application/dto/recipe.dto';
import { AuthMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(AuthMiddleware.authenticate);

router.post('/', zodValidator({ schema: createMenuItemSchema, source: 'body' }), createMenuItemController);
router.get('/', zodValidator({ schema: listMenuItemsSchema, source: 'query' }), listMenuItemsController);
router.get('/:menu_item_id', zodValidator({ schema: getMenuItemSchema, source: 'params' }), getMenuItemController);
router.put('/:menu_item_id', zodValidator({ schema: updateMenuItemSchema, source: 'body' }), updateMenuItemController);
router.delete('/:menu_item_id', zodValidator({ schema: deleteMenuItemSchema, source: 'params' }), deleteMenuItemController);

// Recetas (Fase 5.2)
router.get('/:menu_item_id/recipe', getRecipeController);
router.put(
  '/:menu_item_id/recipe',
  AuthMiddleware.authorize('ADMIN'),
  zodValidator({ schema: replaceRecipeSchema, source: 'body' }),
  replaceRecipeController
);
router.post(
  '/:menu_item_id/recipe/items',
  AuthMiddleware.authorize('ADMIN'),
  zodValidator({ schema: addRecipeItemSchema, source: 'body' }),
  addRecipeItemController
);
router.patch(
  '/:menu_item_id/recipe/items/:product_id',
  AuthMiddleware.authorize('ADMIN'),
  zodValidator({ schema: updateRecipeItemSchema, source: 'body' }),
  updateRecipeItemController
);
router.delete(
  '/:menu_item_id/recipe/items/:product_id',
  AuthMiddleware.authorize('ADMIN'),
  removeRecipeItemController
);

export default router;
