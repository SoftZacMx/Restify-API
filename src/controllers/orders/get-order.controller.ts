import { GetOrderUseCase } from '../../core/application/use-cases/orders/get-order.use-case';
import { makeController } from '../../shared/utils/make-controller';

export const getOrderController = makeController(GetOrderUseCase, {
  mapper: (req) => req.params,
});
