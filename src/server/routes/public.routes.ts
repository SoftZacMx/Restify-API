import { Router } from 'express';
import { listPublicMenuController } from '../../controllers/menu-items/list-public-menu.controller';
import { createPublicOrderController } from '../../controllers/orders/create-public-order.controller';
import { getPublicOrderStatusController } from '../../controllers/orders/get-public-order-status.controller';
import { payPublicOrderController } from '../../controllers/payments/pay-public-order.controller';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { createPublicOrderSchema, payPublicOrderParamsSchema, getPublicOrderStatusParamsSchema } from '../../core/application/dto/order.dto';
import { publicMenuRateLimiter, publicOrderRateLimiter, publicStatusRateLimiter } from '../middleware/rate-limit.middleware';

const router = Router();

/** GET /api/public/menu — Menú público (items activos agrupados por categoría) */
router.get('/menu', publicMenuRateLimiter, listPublicMenuController);

/** POST /api/public/orders — Crear pedido público (sin auth) */
router.post('/orders', publicOrderRateLimiter, zodValidator({ schema: createPublicOrderSchema, source: 'body' }), createPublicOrderController);

/** POST /api/public/orders/:orderId/pay — Pagar pedido público con MP */
router.post('/orders/:orderId/pay', publicOrderRateLimiter, zodValidator({ schema: payPublicOrderParamsSchema, source: 'params' }), payPublicOrderController);

/** GET /api/public/orders/:trackingToken/status — Seguimiento público del pedido */
router.get('/orders/:trackingToken/status', publicStatusRateLimiter, zodValidator({ schema: getPublicOrderStatusParamsSchema, source: 'params' }), getPublicOrderStatusController);

export default router;
