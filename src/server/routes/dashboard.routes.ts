import { Router } from 'express';
import { getDashboardController } from '../../controllers/dashboard';
import { AuthMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(AuthMiddleware.authenticate);

router.get('/', getDashboardController);

export default router;
