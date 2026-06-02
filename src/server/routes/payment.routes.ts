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

// Router separado para webhooks (montado fuera del bloque auth+tenant en index.ts)
const webhookRouter = Router();
webhookRouter.post('/mercado-pago', mercadoPagoWebhookController);
export { webhookRouter as paymentWebhookRoutes };

const router = Router();

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
