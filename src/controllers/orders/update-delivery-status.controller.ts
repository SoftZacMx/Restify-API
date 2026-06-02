import { UpdateDeliveryStatusUseCase } from '../../core/application/use-cases/orders/update-delivery-status.use-case';
import { makeController } from '../../shared/utils/make-controller';

export const updateDeliveryStatusController = makeController(UpdateDeliveryStatusUseCase, {
  mapper: (req) => [req.params.order_id, req.body],
});
