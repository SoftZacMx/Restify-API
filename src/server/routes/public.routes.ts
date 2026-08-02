import { Router } from 'express';
import { listPublicMenuController } from '../../controllers/menu-items/list-public-menu.controller';
import { createPublicOrderController } from '../../controllers/orders/create-public-order.controller';
import { getPublicOrderStatusController, getPublicOrderStatusByIdController } from '../../controllers/orders/get-public-order-status.controller';
import { payPublicOrderController } from '../../controllers/payments/pay-public-order.controller';
import { startPublicCheckoutController } from '../../controllers/payments/start-public-checkout.controller';
import { resolvePublicBranchController } from '../../controllers/branches/resolve-public-branch.controller';
import { GetPublicCheckoutStatusUseCase } from '../../core/application/use-cases/orders/get-public-checkout-status.use-case';
import { makeController } from '../../shared/utils/make-controller';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { createPublicOrderSchema, payPublicOrderParamsSchema, getPublicOrderStatusParamsSchema, getPublicOrderStatusByCheckoutParamsSchema } from '../../core/application/dto/order.dto';
import { publicBranchSlugParamSchema } from '../../core/application/dto/branch.dto';
import { publicMenuRateLimiter, publicOrderRateLimiter, publicStatusRateLimiter } from '../middleware/rate-limit.middleware';
import { PublicTenantMiddleware } from '../middleware/public-tenant.middleware';
import { SubscriptionMiddleware } from '../middleware/subscription.middleware';

const router = Router();

// Suscripción del comercio: se valida tras resolver el tenant (la org sale del branch).
// Solo aplica a las rutas que generan operación nueva (menú/pedidos). Las rutas de
// seguimiento y pago de pedidos existentes quedan fuera: un cliente que ya pidió debe
// poder rastrear/pagar aunque la suscripción del comercio venza después.
const requireMerchantSubscription = SubscriptionMiddleware.validatePublicSubscription;

/** GET /api/public/branch/:slug — Resuelve un slug público a los datos mínimos de la sucursal (incluido branchId) */
router.get('/branch/:slug', publicMenuRateLimiter, zodValidator({ schema: publicBranchSlugParamSchema, source: 'params' }), resolvePublicBranchController);

/** GET /api/public/menu?branchId=xxx — Menú público (items activos agrupados por categoría) */
router.get('/menu', publicMenuRateLimiter, PublicTenantMiddleware.fromBranch, requireMerchantSubscription, listPublicMenuController);

/** POST /api/public/orders — Crear pedido público (sin auth, branchId en body). Flujo legacy. */
router.post('/orders', publicOrderRateLimiter, zodValidator({ schema: createPublicOrderSchema, source: 'body' }), PublicTenantMiddleware.fromBranch, requireMerchantSubscription, createPublicOrderController);

/**
 * POST /api/public/checkout — Inicia el pago SIN crear la orden todavía (Opción A).
 * Guarda un borrador y devuelve el initPoint de Mercado Pago + trackingToken. La orden
 * real se materializa al confirmar el pago (webhook). Reemplaza al par crear-orden + pagar.
 */
router.post('/checkout', publicOrderRateLimiter, zodValidator({ schema: createPublicOrderSchema, source: 'body' }), PublicTenantMiddleware.fromBranch, requireMerchantSubscription, startPublicCheckoutController);

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

/**
 * GET /api/public/orders/by-checkout-id/:checkoutId/status — Seguimiento por checkoutId.
 * Gemelo del anterior para el checkout diferido, donde el external_reference trae el
 * checkoutId y la orden puede no existir todavía.
 */
router.get('/orders/by-checkout-id/:checkoutId/status', publicStatusRateLimiter, zodValidator({ schema: getPublicOrderStatusByCheckoutParamsSchema, source: 'params' }), makeController(GetPublicCheckoutStatusUseCase, { mapper: req => req.params }));

export default router;
