import { UpdateOrderPaymentMethodUseCase } from '../../core/application/use-cases/orders/update-order-payment-method.use-case';
import { makeParamBodyController } from '../../shared/utils/make-controller';

export const updateOrderPaymentMethodController = makeParamBodyController(
  UpdateOrderPaymentMethodUseCase,
  'order_id'
);
