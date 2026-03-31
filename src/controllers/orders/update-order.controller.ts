import { UpdateOrderUseCase } from '../../core/application/use-cases/orders/update-order.use-case';
import { makeParamBodyController } from '../../shared/utils/make-controller';

export const updateOrderController = makeParamBodyController(UpdateOrderUseCase, 'order_id');
