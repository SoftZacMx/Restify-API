import { Router } from 'express';
import {
  getPaymentConfigController,
  savePaymentConfigController,
} from '../../controllers/settings/payment-config.controller';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { OWNER_ADMIN } from '../../shared/constants/roles.constants';

const router = Router();

router.use(AuthMiddleware.authenticate);
router.use(AuthMiddleware.authorize(...OWNER_ADMIN));

/** GET /api/settings/payment-config */
router.get('/payment-config', getPaymentConfigController);

/** PUT /api/settings/payment-config */
router.put('/payment-config', savePaymentConfigController);

export default router;
