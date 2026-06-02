import { ListUsersUseCase } from '../../core/application/use-cases/users/list-users.use-case';
import { makeController } from '../../shared/utils/make-controller';

export const listUsersController = makeController(ListUsersUseCase, {
  mapper: (req) => req.query,
});
