import { UpdateProductUseCase } from '../../core/application/use-cases/products/update-product.use-case';
import { makeController } from '../../shared/utils/make-controller';

export const updateProductController = makeController(UpdateProductUseCase, {
  mapper: (req) => [req.params.product_id, req.body],
});
