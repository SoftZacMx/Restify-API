import { Router } from 'express';
import {
  getPaymentController,
  listPaymentsController,
  getPaymentSessionController,
  payOrderWithQRMercadoPagoController,
  getQRPaymentStatusController,
  mercadoPagoWebhookController,
} from '../../controllers/payments';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { mpWebhookRateLimiter } from '../middleware/rate-limit.middleware';
import {
  payOrderWithQRMercadoPagoSchema,
  getPaymentSchema,
  listPaymentsSchema,
  getPaymentSessionSchema,
  getQRPaymentStatusSchema,
} from '../../core/application/dto/payment.dto';

// Router separado para webhooks (montado fuera del bloque auth+tenant en index.ts)
const webhookRouter = Router();
webhookRouter.post('/mercado-pago', mpWebhookRateLimiter, mercadoPagoWebhookController);
export { webhookRouter as paymentWebhookRoutes };

const router = Router();

/** POST /api/payments/qr-mercado-pago */
router.post('/qr-mercado-pago', zodValidator({ schema: payOrderWithQRMercadoPagoSchema, source: 'body' }), payOrderWithQRMercadoPagoController);

/** GET /api/payments/qr-mercado-pago/:orderId */
router.get('/qr-mercado-pago/:orderId', zodValidator({ schema: getQRPaymentStatusSchema, source: 'params' }), getQRPaymentStatusController);

/** GET /api/payments */
router.get('/', zodValidator({ schema: listPaymentsSchema, source: 'query' }), listPaymentsController);

/** GET /api/payments/:payment_id */
router.get('/:payment_id', zodValidator({ schema: getPaymentSchema, source: 'params' }), getPaymentController);

/** GET /api/payments/:payment_id/session */
router.get('/:payment_id/session', zodValidator({ schema: getPaymentSessionSchema, source: 'params' }), getPaymentSessionController);

export default router;
