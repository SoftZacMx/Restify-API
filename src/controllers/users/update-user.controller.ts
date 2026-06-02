import { UpdateUserUseCase } from '../../core/application/use-cases/users/update-user.use-case';
import { makeController } from '../../shared/utils/make-controller';

export const updateUserController = makeController(UpdateUserUseCase, {
  mapper: (req) => [req.params.user_id, req.body],
});
