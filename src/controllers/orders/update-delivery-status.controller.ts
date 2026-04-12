import { UpdateDeliveryStatusUseCase } from '../../core/application/use-cases/orders/update-delivery-status.use-case';
import { makeParamBodyController } from '../../shared/utils/make-controller';

export const updateDeliveryStatusController = makeParamBodyController(UpdateDeliveryStatusUseCase, 'order_id');
