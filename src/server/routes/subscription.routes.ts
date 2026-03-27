import { Router, Request, Response } from 'express';
import {
  createSubscriptionCheckoutHandler,
  getSubscriptionStatusHandler,
  cancelSubscriptionHandler,
  reactivateSubscriptionHandler,
  stripeWebhookHandler,
} from '../../handlers/subscription';
import { HttpToLambdaAdapter } from '../../shared/utils/http-to-lambda.adapter';
import { AuthMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Webhook de Stripe — sin autenticación, body raw (configurado en server.ts)
router.post('/webhooks/stripe', async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req);
    // Body llega como Buffer gracias al express.raw() en server.ts
    event.body = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : req.body;
    const context = HttpToLambdaAdapter.createContext();
    const response = await stripeWebhookHandler(event as any, context);
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('Stripe subscription webhook route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred processing the webhook',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

// Rutas protegidas con autenticación
router.use(AuthMiddleware.authenticate);

// POST /api/subscription/checkout — Crear checkout session (no body needed)
router.post('/checkout', async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req);
    event.body = null; // No body required - userId comes from JWT
    const context = HttpToLambdaAdapter.createContext();
    const response = await createSubscriptionCheckoutHandler(event as any, context);
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('Create subscription checkout route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred processing the checkout request',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

// GET /api/subscription/status — Obtener estado de suscripción
router.get('/status', async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req);
    const context = HttpToLambdaAdapter.createContext();
    const response = await getSubscriptionStatusHandler(event as any, context);
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('Get subscription status route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred getting the subscription status',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

// POST /api/subscription/cancel — Cancelar suscripción
router.post('/cancel', async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req);
    const context = HttpToLambdaAdapter.createContext();
    const response = await cancelSubscriptionHandler(event as any, context);
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('Cancel subscription route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred canceling the subscription',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

// POST /api/subscription/reactivate — Reactivar suscripción
router.post('/reactivate', async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req);
    const context = HttpToLambdaAdapter.createContext();
    const response = await reactivateSubscriptionHandler(event as any, context);
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('Reactivate subscription route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred reactivating the subscription',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
