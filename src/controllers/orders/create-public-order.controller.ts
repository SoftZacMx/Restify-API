import { CreatePublicOrderUseCase } from '../../core/application/use-cases/orders/create-public-order.use-case';
import { makeController } from '../../shared/utils/make-controller';

export const createPublicOrderController = makeController(CreatePublicOrderUseCase);
