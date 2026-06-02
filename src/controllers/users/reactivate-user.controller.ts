import { ReactivateUserUseCase } from '../../core/application/use-cases/users/reactivate-user.use-case';
import { makeController } from '../../shared/utils/make-controller';

export const reactivateUserController = makeController(ReactivateUserUseCase, {
  mapper: (req) => req.params,
  responseMapper: () => ({ message: 'User reactivated successfully' }),
});
