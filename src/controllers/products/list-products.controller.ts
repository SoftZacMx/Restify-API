import { ListProductsUseCase } from '../../core/application/use-cases/products/list-products.use-case';
import { makeQueryController } from '../../shared/utils/make-controller';

export const listProductsController = makeQueryController(ListProductsUseCase);
