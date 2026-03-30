import { Router } from 'express';
import {
  createProductController,
  getProductController,
  listProductsController,
  updateProductController,
  deleteProductController,
} from '../../controllers/products';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { createProductSchema, getProductSchema, listProductsSchema, deleteProductSchema } from '../../core/application/dto/product.dto';

const router = Router();

router.post('/', zodValidator({ schema: createProductSchema, source: 'body' }), createProductController);
router.get('/', zodValidator({ schema: listProductsSchema, source: 'query' }), listProductsController);
router.get('/:product_id', zodValidator({ schema: getProductSchema, source: 'params' }), getProductController);
router.put('/:product_id', updateProductController);
router.delete('/:product_id', zodValidator({ schema: deleteProductSchema, source: 'params' }), deleteProductController);

export default router;
