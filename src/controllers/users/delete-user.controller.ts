import { DeleteUserUseCase } from '../../core/application/use-cases/users/delete-user.use-case';
import { makeController } from '../../shared/utils/make-controller';

export const deleteUserController = makeController(DeleteUserUseCase, {
  mapper: (req) => req.params,
  responseMapper: () => ({ message: 'User deleted successfully' }),
});
