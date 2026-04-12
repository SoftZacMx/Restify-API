import { Router } from 'express';

const router = Router();

// GET /api/public/menu — Menú público (items activos agrupados por categoría)
// router.get('/menu', listPublicMenuController);

// GET /api/public/menu/categories — Categorías públicas
// router.get('/menu/categories', listPublicCategoriesController);

// POST /api/public/orders — Crear pedido público (sin auth)
// router.post('/orders', createPublicOrderController);

// POST /api/public/orders/:orderId/pay — Pagar pedido público con MP
// router.post('/orders/:orderId/pay', payPublicOrderController);

// GET /api/public/orders/:trackingToken/status — Seguimiento público del pedido
// router.get('/orders/:trackingToken/status', getPublicOrderStatusController);

export default router;
