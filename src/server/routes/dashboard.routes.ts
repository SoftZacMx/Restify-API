import { Router } from 'express';
import { getDashboardController } from '../../controllers/dashboard';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { MANAGER_AND_UP } from '../../shared/constants/roles.constants';

const router = Router();

router.use(AuthMiddleware.authenticate);
router.use(AuthMiddleware.authorize(...MANAGER_AND_UP));

router.get('/', getDashboardController);

export default router;
