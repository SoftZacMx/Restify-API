import { Router } from 'express';
import { listPublicMenuController } from '../../controllers/menu-items/list-public-menu.controller';
import { createPublicOrderController } from '../../controllers/orders/create-public-order.controller';
import { getPublicOrderStatusController, getPublicOrderStatusByIdController } from '../../controllers/orders/get-public-order-status.controller';
import { payPublicOrderController } from '../../controllers/payments/pay-public-order.controller';
import { startPublicCheckoutController } from '../../controllers/payments/start-public-checkout.controller';
import { resolvePublicBranchController } from '../../controllers/branches/resolve-public-branch.controller';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { createPublicOrderSchema, payPublicOrderParamsSchema, getPublicOrderStatusParamsSchema } from '../../core/application/dto/order.dto';
import { publicBranchSlugParamSchema } from '../../core/application/dto/branch.dto';
import { publicMenuRateLimiter, publicOrderRateLimiter, publicStatusRateLimiter } from '../middleware/rate-limit.middleware';
import { PublicTenantMiddleware } from '../middleware/public-tenant.middleware';

const router = Router();

/** GET /api/public/branch/:slug — Resuelve un slug público a los datos mínimos de la sucursal (incluido branchId) */
router.get('/branch/:slug', publicMenuRateLimiter, zodValidator({ schema: publicBranchSlugParamSchema, source: 'params' }), resolvePublicBranchController);

/** GET /api/public/menu?branchId=xxx — Menú público (items activos agrupados por categoría) */
router.get('/menu', publicMenuRateLimiter, PublicTenantMiddleware.fromBranch, listPublicMenuController);

/** POST /api/public/orders — Crear pedido público (sin auth, branchId en body). Flujo legacy. */
router.post('/orders', publicOrderRateLimiter, zodValidator({ schema: createPublicOrderSchema, source: 'body' }), PublicTenantMiddleware.fromBranch, createPublicOrderController);

/**
 * POST /api/public/checkout — Inicia el pago SIN crear la orden todavía (Opción A).
 * Guarda un borrador y devuelve el initPoint de Mercado Pago + trackingToken. La orden
 * real se materializa al confirmar el pago (webhook). Reemplaza al par crear-orden + pagar.
 */
router.post('/checkout', publicOrderRateLimiter, zodValidator({ schema: createPublicOrderSchema, source: 'body' }), PublicTenantMiddleware.fromBranch, startPublicCheckoutController);

/** POST /api/public/orders/:orderId/pay — Pagar pedido público con MP */
router.post('/orders/:orderId/pay', publicOrderRateLimiter, zodValidator({ schema: payPublicOrderParamsSchema, source: 'params' }), payPublicOrderController);

/** GET /api/public/orders/:trackingToken/status — Seguimiento público del pedido */
router.get('/orders/:trackingToken/status', publicStatusRateLimiter, zodValidator({ schema: getPublicOrderStatusParamsSchema, source: 'params' }), getPublicOrderStatusController);

/**
 * GET /api/public/orders/by-order-id/:orderId/status — Seguimiento por orderId.
 * Usado en el retorno de Mercado Pago (external_reference trae el orderId), cuando el
 * cliente perdió el trackingToken. Path distinto para no colisionar con la ruta por token.
 */
router.get('/orders/by-order-id/:orderId/status', publicStatusRateLimiter, zodValidator({ schema: payPublicOrderParamsSchema, source: 'params' }), getPublicOrderStatusByIdController);

export default router;
