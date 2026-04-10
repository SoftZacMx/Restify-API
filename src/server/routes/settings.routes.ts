import { Router } from 'express';
import {
  getPaymentConfigController,
  savePaymentConfigController,
} from '../../controllers/settings/payment-config.controller';
import { AuthMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(AuthMiddleware.authenticate);
router.use(AuthMiddleware.authorize('ADMIN'));

/** GET /api/settings/payment-config */
router.get('/payment-config', getPaymentConfigController);

/** PUT /api/settings/payment-config */
router.put('/payment-config', savePaymentConfigController);

export default router;
