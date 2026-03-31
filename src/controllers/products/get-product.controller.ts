import { GetProductUseCase } from '../../core/application/use-cases/products/get-product.use-case';
import { makeParamsController } from '../../shared/utils/make-controller';

export const getProductController = makeParamsController(GetProductUseCase);
