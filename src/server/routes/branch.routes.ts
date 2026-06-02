import { Router } from 'express';
import {
  listBranchesController,
  getBranchController,
  createBranchController,
  updateBranchController,
  disableBranchController,
  enableBranchController,
} from '../../controllers/branches';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import {
  createBranchSchema,
  updateBranchSchema,
  listBranchesQuerySchema,
  branchIdParamSchema,
} from '../../core/application/dto/branch.dto';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { OWNER_ADMIN } from '../../shared/constants/roles.constants';

const router = Router();

// Note: AuthMiddleware and TenantMiddleware are applied globally in routes/index.ts

router.get(
  '/',
  zodValidator({ schema: listBranchesQuerySchema, source: 'query' }),
  listBranchesController
);
router.get(
  '/:branch_id',
  zodValidator({ schema: branchIdParamSchema, source: 'params' }),
  getBranchController
);
router.post(
  '/',
  AuthMiddleware.authorize(...OWNER_ADMIN),
  zodValidator({ schema: createBranchSchema, source: 'body' }),
  createBranchController
);
router.patch(
  '/:branch_id',
  AuthMiddleware.authorize(...OWNER_ADMIN),
  zodValidator({ schema: branchIdParamSchema, source: 'params' }),
  zodValidator({ schema: updateBranchSchema, source: 'body' }),
  updateBranchController
);
router.post(
  '/:branch_id/disable',
  AuthMiddleware.authorize(...OWNER_ADMIN),
  zodValidator({ schema: branchIdParamSchema, source: 'params' }),
  disableBranchController
);
router.post(
  '/:branch_id/enable',
  AuthMiddleware.authorize(...OWNER_ADMIN),
  zodValidator({ schema: branchIdParamSchema, source: 'params' }),
  enableBranchController
);

export default router;
