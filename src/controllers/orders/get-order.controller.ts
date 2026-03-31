import { GetOrderUseCase } from '../../core/application/use-cases/orders/get-order.use-case';
import { makeParamsController } from '../../shared/utils/make-controller';

export const getOrderController = makeParamsController(GetOrderUseCase);
