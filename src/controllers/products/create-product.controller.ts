import { CreateProductUseCase } from '../../core/application/use-cases/products/create-product.use-case';
import { makeBodyController } from '../../shared/utils/make-controller';

export const createProductController = makeBodyController(CreateProductUseCase);
