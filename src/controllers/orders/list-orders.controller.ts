import { ListOrdersUseCase } from '../../core/application/use-cases/orders/list-orders.use-case';
import { makeController } from '../../shared/utils/make-controller';

export const listOrdersController = makeController(ListOrdersUseCase, {
  mapper: (req) => req.query,
});
