import { GetProductUseCase } from '../../core/application/use-cases/products/get-product.use-case';
import { makeController } from '../../shared/utils/make-controller';

export const getProductController = makeController(GetProductUseCase, {
  mapper: (req) => req.params,
});
