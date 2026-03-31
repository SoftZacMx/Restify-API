import { ReactivateUserUseCase } from '../../core/application/use-cases/users/reactivate-user.use-case';
import { makeDeleteController } from '../../shared/utils/make-controller';

export const reactivateUserController = makeDeleteController(ReactivateUserUseCase, 'User reactivated successfully');
