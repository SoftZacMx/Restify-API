import { ListProductsUseCase } from '../../core/application/use-cases/products/list-products.use-case';
import { makeController } from '../../shared/utils/make-controller';

export const listProductsController = makeController(ListProductsUseCase, {
  mapper: (req) => req.query,
});
