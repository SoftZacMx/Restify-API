import { GetBranchUseCase } from '../../core/application/use-cases/branches/get-branch.use-case';
import { makeController } from '../../shared/utils/make-controller';

export const getBranchController = makeController(GetBranchUseCase, {
  mapper: (req) => ({
    branchId: req.params.branch_id,
  }),
  requireAuth: true,
});
