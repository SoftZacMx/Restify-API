import { Router } from 'express';
import {
  createMenuCategoryController,
  getMenuCategoryController,
  listMenuCategoriesController,
  updateMenuCategoryController,
  deleteMenuCategoryController,
} from '../../controllers/menu-categories';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { createMenuCategorySchema, getMenuCategorySchema, listMenuCategoriesSchema, deleteMenuCategorySchema } from '../../core/application/dto/menu-category.dto';

const router = Router();

router.post('/', zodValidator({ schema: createMenuCategorySchema, source: 'body' }), createMenuCategoryController);
router.get('/', zodValidator({ schema: listMenuCategoriesSchema, source: 'query' }), listMenuCategoriesController);
router.get('/:category_id', zodValidator({ schema: getMenuCategorySchema, source: 'params' }), getMenuCategoryController);
router.put('/:category_id', updateMenuCategoryController);
router.delete('/:category_id', zodValidator({ schema: deleteMenuCategorySchema, source: 'params' }), deleteMenuCategoryController);

export default router;
