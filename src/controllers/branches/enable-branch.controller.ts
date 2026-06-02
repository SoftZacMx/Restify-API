import { EnableBranchUseCase } from '../../core/application/use-cases/branches/enable-branch.use-case';
import { makeController } from '../../shared/utils/make-controller';

export const enableBranchController = makeController(EnableBranchUseCase, {
  mapper: (req) => ({
    branchId: req.params.branch_id,
  }),
  requireAuth: true,
});
