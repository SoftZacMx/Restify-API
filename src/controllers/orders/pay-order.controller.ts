import { PayOrderUseCase } from '../../core/application/use-cases/orders/pay-order.use-case';
import { makeController } from '../../shared/utils/make-controller';

export const payOrderController = makeController(PayOrderUseCase);
