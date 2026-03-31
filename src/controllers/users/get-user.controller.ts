import { GetUserUseCase } from '../../core/application/use-cases/users/get-user.use-case';
import { makeParamsController } from '../../shared/utils/make-controller';

export const getUserController = makeParamsController(GetUserUseCase);
