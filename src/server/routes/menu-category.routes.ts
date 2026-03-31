import { Router } from 'express';
import {
  createMenuCategoryController,
  getMenuCategoryController,
  listMenuCategoriesController,
  updateMenuCategoryController,
  deleteMenuCategoryController,
} from '../../controllers/menu-categories';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { createMenuCategorySchema, getMenuCategorySchema, listMenuCategoriesSchema, updateMenuCategorySchema, deleteMenuCategorySchema } from '../../core/application/dto/menu-category.dto';
import { AuthMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(AuthMiddleware.authenticate);

router.post('/', zodValidator({ schema: createMenuCategorySchema, source: 'body' }), createMenuCategoryController);
router.get('/', zodValidator({ schema: listMenuCategoriesSchema, source: 'query' }), listMenuCategoriesController);
router.get('/:category_id', zodValidator({ schema: getMenuCategorySchema, source: 'params' }), getMenuCategoryController);
router.put('/:category_id', zodValidator({ schema: updateMenuCategorySchema, source: 'body' }), updateMenuCategoryController);
router.delete('/:category_id', zodValidator({ schema: deleteMenuCategorySchema, source: 'params' }), deleteMenuCategoryController);

export default router;
