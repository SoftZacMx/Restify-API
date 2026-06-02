import { DeleteProductUseCase } from '../../core/application/use-cases/products/delete-product.use-case';
import { makeController } from '../../shared/utils/make-controller';

export const deleteProductController = makeController(DeleteProductUseCase, {
  mapper: (req) => req.params,
  responseMapper: () => ({ message: 'Product deleted successfully' }),
});
