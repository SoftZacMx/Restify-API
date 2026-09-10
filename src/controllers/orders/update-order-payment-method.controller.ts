import { UpdateOrderPaymentMethodUseCase } from '../../core/application/use-cases/orders/update-order-payment-method.use-case';
import { makeController } from '../../shared/utils/make-controller';

export const updateOrderPaymentMethodController = makeController(UpdateOrderPaymentMethodUseCase, {
  mapper: (req) => [req.params.order_id, req.body],
});
