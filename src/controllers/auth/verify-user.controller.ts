import { VerifyUserUseCase } from '../../core/application/use-cases/auth/verify-user.use-case';
import { makeController } from '../../shared/utils/make-controller';

export const verifyUserController = makeController(VerifyUserUseCase);
