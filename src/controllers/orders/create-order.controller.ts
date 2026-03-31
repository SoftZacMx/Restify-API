import { CreateOrderUseCase } from '../../core/application/use-cases/orders/create-order.use-case';
import { makeBodyController } from '../../shared/utils/make-controller';

export const createOrderController = makeBodyController(CreateOrderUseCase);
