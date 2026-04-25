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

// Rutas protegidas con autenticación
router.use(AuthMiddleware.authenticate);

/**
 * GET /api/subscription/status — Accesible por cualquier usuario autenticado.
 * El SubscriptionGuard del frontend lo consulta tras el login para decidir si
 * permitir el acceso a la app. Si solo lo pudieran consultar admins, los
 * meseros/cocineros recibirían 403 y el guard lo interpretaría como
 * "suscripción vencida", bloqueándolos aunque la suscripción esté activa.
 */
router.get('/status', getSubscriptionStatusController);

// Rutas que sí requieren rol ADMIN (gestión de la suscripción)
router.use(AuthMiddleware.authorize('ADMIN'));

/** POST /api/subscription/checkout */
router.post('/checkout', createSubscriptionCheckoutController);

/** POST /api/subscription/verify-checkout — Verifica y actualiza estado post-pago */
router.post('/verify-checkout', verifySubscriptionCheckoutController);

/** POST /api/subscription/cancel */
router.post('/cancel', cancelSubscriptionController);

/** POST /api/subscription/reactivate */
router.post('/reactivate', reactivateSubscriptionController);

export default router;
