import { UpdateBranchUseCase } from '../../core/application/use-cases/branches/update-branch.use-case';
import { makeController } from '../../shared/utils/make-controller';

export const updateBranchController = makeController(UpdateBranchUseCase, {
  mapper: (req) => ({
    branchId: req.params.branch_id,
    data: req.body,
  }),
  requireAuth: true,
});
