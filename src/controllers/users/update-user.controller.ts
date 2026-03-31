import { UpdateUserUseCase } from '../../core/application/use-cases/users/update-user.use-case';
import { makeParamBodyController } from '../../shared/utils/make-controller';

export const updateUserController = makeParamBodyController(UpdateUserUseCase, 'user_id');
