import { LogoutUseCase } from '../../core/application/use-cases/auth/logout.use-case';
import { makeController } from '../../shared/utils/make-controller';

export const logoutController = makeController(LogoutUseCase, { mapper: () => ({}) });
