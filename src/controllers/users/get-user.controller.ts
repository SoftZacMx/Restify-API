import { GetUserUseCase } from '../../core/application/use-cases/users/get-user.use-case';
import { makeController } from '../../shared/utils/make-controller';

export const getUserController = makeController(GetUserUseCase, {
  mapper: (req) => req.params,
});
