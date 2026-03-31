import { CreateUserUseCase } from '../../core/application/use-cases/users/create-user.use-case';
import { makeBodyController } from '../../shared/utils/make-controller';

export const createUserController = makeBodyController(CreateUserUseCase);
