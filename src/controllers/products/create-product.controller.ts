import { CreateProductUseCase } from '../../core/application/use-cases/products/create-product.use-case';
import { makeController } from '../../shared/utils/make-controller';

export const createProductController = makeController(CreateProductUseCase);
