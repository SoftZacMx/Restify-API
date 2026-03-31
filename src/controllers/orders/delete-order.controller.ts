import { DeleteOrderUseCase } from '../../core/application/use-cases/orders/delete-order.use-case';
import { makeDeleteController } from '../../shared/utils/make-controller';

export const deleteOrderController = makeDeleteController(DeleteOrderUseCase, 'Order deleted successfully');
