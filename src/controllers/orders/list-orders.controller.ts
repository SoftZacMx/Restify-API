import { ListOrdersUseCase } from '../../core/application/use-cases/orders/list-orders.use-case';
import { makeQueryController } from '../../shared/utils/make-controller';

export const listOrdersController = makeQueryController(ListOrdersUseCase);
