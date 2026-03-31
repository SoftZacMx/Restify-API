import { DeleteUserUseCase } from '../../core/application/use-cases/users/delete-user.use-case';
import { makeDeleteController } from '../../shared/utils/make-controller';

export const deleteUserController = makeDeleteController(DeleteUserUseCase, 'User deleted successfully');
