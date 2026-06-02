import { CreateUserUseCase } from '../../core/application/use-cases/users/create-user.use-case';
import { makeController } from '../../shared/utils/make-controller';

export const createUserController = makeController(CreateUserUseCase);
