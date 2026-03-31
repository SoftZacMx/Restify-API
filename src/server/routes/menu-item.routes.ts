import { Router } from 'express';
import {
  createMenuItemController,
  getMenuItemController,
  listMenuItemsController,
  updateMenuItemController,
  deleteMenuItemController,
} from '../../controllers/menu-items';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { createMenuItemSchema, getMenuItemSchema, listMenuItemsSchema, updateMenuItemSchema, deleteMenuItemSchema } from '../../core/application/dto/menu-item.dto';
import { AuthMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(AuthMiddleware.authenticate);

router.post('/', zodValidator({ schema: createMenuItemSchema, source: 'body' }), createMenuItemController);
router.get('/', zodValidator({ schema: listMenuItemsSchema, source: 'query' }), listMenuItemsController);
router.get('/:menu_item_id', zodValidator({ schema: getMenuItemSchema, source: 'params' }), getMenuItemController);
router.put('/:menu_item_id', zodValidator({ schema: updateMenuItemSchema, source: 'body' }), updateMenuItemController);
router.delete('/:menu_item_id', zodValidator({ schema: deleteMenuItemSchema, source: 'params' }), deleteMenuItemController);

export default router;
