import { ResolvePublicBranchUseCase } from '../../core/application/use-cases/branches/resolve-public-branch.use-case';
import { makeController } from '../../shared/utils/make-controller';

export const resolvePublicBranchController = makeController(ResolvePublicBranchUseCase, {
  mapper: req => ({ slug: req.params.slug }),
});
