import { Router } from 'express';
import {
  createProductController,
  getProductController,
  listProductsController,
  updateProductController,
  deleteProductController,
} from '../../controllers/products';
import {
  listStockController,
  listProductMovementsController,
  updateStockConfigController,
} from '../../controllers/stock';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { createProductSchema, getProductSchema, listProductsSchema, updateProductSchema, deleteProductSchema } from '../../core/application/dto/product.dto';
import {
  listStockQuerySchema,
  listMovementsQuerySchema,
  updateStockConfigSchema,
} from '../../core/application/dto/stock.dto';
import { AuthMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(AuthMiddleware.authenticate);

// Stock (declarado ANTES de /:product_id para que no choque)
router.get('/stock', zodValidator({ schema: listStockQuerySchema, source: 'query' }), listStockController);
router.get(
  '/:product_id/movements',
  zodValidator({ schema: listMovementsQuerySchema, source: 'query' }),
  listProductMovementsController
);
router.patch(
  '/:product_id/stock-config',
  AuthMiddleware.authorize('ADMIN'),
  zodValidator({ schema: updateStockConfigSchema, source: 'body' }),
  updateStockConfigController
);

router.post('/', zodValidator({ schema: createProductSchema, source: 'body' }), createProductController);
router.get('/', zodValidator({ schema: listProductsSchema, source: 'query' }), listProductsController);
router.get('/:product_id', zodValidator({ schema: getProductSchema, source: 'params' }), getProductController);
router.put('/:product_id', zodValidator({ schema: updateProductSchema, source: 'body' }), updateProductController);
router.delete('/:product_id', zodValidator({ schema: deleteProductSchema, source: 'params' }), deleteProductController);

export default router;
