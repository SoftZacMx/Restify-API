import { DeleteOrderUseCase } from '../../core/application/use-cases/orders/delete-order.use-case';
import { makeController } from '../../shared/utils/make-controller';

export const deleteOrderController = makeController(DeleteOrderUseCase, {
  mapper: (req) => req.params,
  responseMapper: () => ({ message: 'Order deleted successfully' }),
});
