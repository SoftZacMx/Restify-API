import { CreatePublicOrderUseCase } from '../../core/application/use-cases/orders/create-public-order.use-case';
import { makeBodyController } from '../../shared/utils/make-controller';

export const createPublicOrderController = makeBodyController(CreatePublicOrderUseCase);
