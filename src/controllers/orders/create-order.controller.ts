import { CreateOrderUseCase } from '../../core/application/use-cases/orders/create-order.use-case';
import { makeController } from '../../shared/utils/make-controller';

export const createOrderController = makeController(CreateOrderUseCase);
