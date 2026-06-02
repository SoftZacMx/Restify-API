import { LoginUseCase } from '../../core/application/use-cases/auth/login.use-case';
import { makeController } from '../../shared/utils/make-controller';

export const loginController = makeController(LoginUseCase);
