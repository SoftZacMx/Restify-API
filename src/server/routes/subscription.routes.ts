import { Router, Request, Response, NextFunction } from 'express';
import {
  createSubscriptionCheckoutController,
  getSubscriptionStatusController,
  cancelSubscriptionController,
  reactivateSubscriptionController,
  stripeWebhookController,
  listSubscriptionPlansController,
  verifySubscriptionCheckoutController,
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

/** GET /api/subscription/plans — Ruta pública (el frontend la necesita antes del login) */
router.get('/plans', listSubscriptionPlansController);

// Rutas protegidas con autenticación - solo ADMIN
router.use(AuthMiddleware.authenticate);
router.use(AuthMiddleware.authorize('ADMIN'));

/** POST /api/subscription/checkout */
router.post('/checkout', createSubscriptionCheckoutController);

/** POST /api/subscription/verify-checkout — Verifica y actualiza estado post-pago */
router.post('/verify-checkout', verifySubscriptionCheckoutController);

/** GET /api/subscription/status */
router.get('/status', getSubscriptionStatusController);

/** POST /api/subscription/cancel */
router.post('/cancel', cancelSubscriptionController);

/** POST /api/subscription/reactivate */
router.post('/reactivate', reactivateSubscriptionController);

export default router;
