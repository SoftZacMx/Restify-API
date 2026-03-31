import { Router, Request, Response, NextFunction } from 'express';
import {
  createSubscriptionCheckoutController,
  getSubscriptionStatusController,
  cancelSubscriptionController,
  reactivateSubscriptionController,
  stripeWebhookController,
} from '../../controllers/subscription';
import { AuthMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Webhook de Stripe — sin autenticación, body raw (configurado en server.ts)
router.post('/webhooks/stripe', (req: Request, res: Response, next: NextFunction) => {
  // Body llega como Buffer gracias al express.raw() en server.ts
  if (Buffer.isBuffer(req.body)) {
    req.body = req.body.toString('utf8');
  }
  stripeWebhookController(req, res, next);
});

// Rutas protegidas con autenticación - solo ADMIN
router.use(AuthMiddleware.authenticate);
router.use(AuthMiddleware.authorize('ADMIN'));

/** POST /api/subscription/checkout */
router.post('/checkout', createSubscriptionCheckoutController);

/** GET /api/subscription/status */
router.get('/status', getSubscriptionStatusController);

/** POST /api/subscription/cancel */
router.post('/cancel', cancelSubscriptionController);

/** POST /api/subscription/reactivate */
router.post('/reactivate', reactivateSubscriptionController);

export default router;
