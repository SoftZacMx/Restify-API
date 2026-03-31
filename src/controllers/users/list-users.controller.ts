import { ListUsersUseCase } from '../../core/application/use-cases/users/list-users.use-case';
import { makeQueryController } from '../../shared/utils/make-controller';

export const listUsersController = makeQueryController(ListUsersUseCase);
