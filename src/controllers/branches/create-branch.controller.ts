import { CreateBranchUseCase } from '../../core/application/use-cases/branches/create-branch.use-case';
import { makeController } from '../../shared/utils/make-controller';

export const createBranchController = makeController(CreateBranchUseCase);
