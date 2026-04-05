import { Router } from 'express';
import {
  payOrderWithCardStripeController,
  confirmStripePaymentController,
  getPaymentController,
  listPaymentsController,
  getPaymentSessionController,
  payOrderWithQRMercadoPagoController,
  getQRPaymentStatusController,
  mercadoPagoWebhookController,
} from '../../controllers/payments';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import {
  payOrderWithCardStripeSchema,
  payOrderWithQRMercadoPagoSchema,
  confirmStripePaymentSchema,
  getPaymentSchema,
  listPaymentsSchema,
  getPaymentSessionSchema,
  getQRPaymentStatusSchema,
} from '../../core/application/dto/payment.dto';
import { AuthMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Webhook de Mercado Pago — sin autenticación (MP envía directamente)
router.post('/webhooks/mercado-pago', mercadoPagoWebhookController);

// Apply authentication to all routes below
router.use(AuthMiddleware.authenticate);

/** POST /api/payments/card-stripe */
router.post('/card-stripe', zodValidator({ schema: payOrderWithCardStripeSchema, source: 'body' }), payOrderWithCardStripeController);

/** POST /api/payments/qr-mercado-pago */
router.post('/qr-mercado-pago', zodValidator({ schema: payOrderWithQRMercadoPagoSchema, source: 'body' }), payOrderWithQRMercadoPagoController);

/** GET /api/payments/qr-mercado-pago/:orderId */
router.get('/qr-mercado-pago/:orderId', zodValidator({ schema: getQRPaymentStatusSchema, source: 'params' }), getQRPaymentStatusController);

/** POST /api/payments/stripe/confirm */
router.post('/stripe/confirm', zodValidator({ schema: confirmStripePaymentSchema, source: 'body' }), confirmStripePaymentController);

/** GET /api/payments */
router.get('/', zodValidator({ schema: listPaymentsSchema, source: 'query' }), listPaymentsController);

/** GET /api/payments/:payment_id */
router.get('/:payment_id', zodValidator({ schema: getPaymentSchema, source: 'params' }), getPaymentController);

/** GET /api/payments/:payment_id/session */
router.get('/:payment_id/session', zodValidator({ schema: getPaymentSessionSchema, source: 'params' }), getPaymentSessionController);

export default router;
