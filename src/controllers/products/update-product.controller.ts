import { UpdateProductUseCase } from '../../core/application/use-cases/products/update-product.use-case';
import { makeParamBodyController } from '../../shared/utils/make-controller';

export const updateProductController = makeParamBodyController(UpdateProductUseCase, 'product_id');
