import { ListBranchesUseCase } from '../../core/application/use-cases/branches/list-branches.use-case';
import { makeController } from '../../shared/utils/make-controller';

export const listBranchesController = makeController(ListBranchesUseCase, {
  mapper: req => req.query,
  requireAuth: true,
});
