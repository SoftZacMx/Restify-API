import { StartPublicCheckoutUseCase } from '../../core/application/use-cases/payments/start-public-checkout.use-case';
import { makeController } from '../../shared/utils/make-controller';

export const startPublicCheckoutController = makeController(StartPublicCheckoutUseCase);
