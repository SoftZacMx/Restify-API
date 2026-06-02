import { UpdateOrderUseCase } from '../../core/application/use-cases/orders/update-order.use-case';
import { makeController } from '../../shared/utils/make-controller';

export const updateOrderController = makeController(UpdateOrderUseCase, {
  mapper: (req) => [req.params.order_id, req.body],
});
