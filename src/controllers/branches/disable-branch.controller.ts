import { DisableBranchUseCase } from '../../core/application/use-cases/branches/disable-branch.use-case';
import { makeController } from '../../shared/utils/make-controller';

export const disableBranchController = makeController(DisableBranchUseCase, {
  mapper: (req) => ({
    branchId: req.params.branch_id,
  }),
  requireAuth: true,
});
