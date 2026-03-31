import { DeleteProductUseCase } from '../../core/application/use-cases/products/delete-product.use-case';
import { makeDeleteController } from '../../shared/utils/make-controller';

export const deleteProductController = makeDeleteController(DeleteProductUseCase, 'Product deleted successfully');
