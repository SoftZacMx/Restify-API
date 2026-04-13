import { Router } from 'express';
import {
  createOrderController,
  getOrderController,
  getKitchenTicketController,
  getSaleTicketController,
  listOrdersController,
  updateOrderController,
  deleteOrderController,
  payOrderController,
  updateDeliveryStatusController,
} from '../../controllers/orders';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { createOrderSchema, listOrdersSchema, getOrderSchema, updateOrderSchema, deleteOrderSchema, updateDeliveryStatusSchema } from '../../core/application/dto/order.dto';
import { payOrderSchema } from '../../core/application/dto/payment.dto';
import { AuthMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(AuthMiddleware.authenticate);

/** POST /api/orders */
router.post('/', zodValidator({ schema: createOrderSchema, source: 'body' }), createOrderController);

/** GET /api/orders */
router.get('/', zodValidator({ schema: listOrdersSchema, source: 'query' }), listOrdersController);

/** POST /api/orders/:order_id/pay */
router.post('/:order_id/pay', (req, res, next) => {
  req.body = { ...req.body, orderId: req.params.order_id };
  next();
}, zodValidator({ schema: payOrderSchema, source: 'body' }), payOrderController);

/** GET /api/orders/:order_id/ticket/kitchen-ticket */
router.get('/:order_id/ticket/kitchen-ticket', zodValidator({ schema: getOrderSchema, source: 'params' }), getKitchenTicketController);

/** GET /api/orders/:order_id/ticket/sale-ticket */
router.get('/:order_id/ticket/sale-ticket', zodValidator({ schema: getOrderSchema, source: 'params' }), getSaleTicketController);

/** GET /api/orders/:order_id */
router.get('/:order_id', zodValidator({ schema: getOrderSchema, source: 'params' }), getOrderController);

/** PUT /api/orders/:order_id/delivery-status */
router.put('/:order_id/delivery-status', AuthMiddleware.authorize('ADMIN', 'MANAGER'), zodValidator({ schema: updateDeliveryStatusSchema, source: 'body' }), updateDeliveryStatusController);

/** PUT /api/orders/:order_id */
router.put('/:order_id', zodValidator({ schema: updateOrderSchema, source: 'body' }), updateOrderController);

/** DELETE /api/orders/:order_id (solo ADMIN y MANAGER) */
router.delete('/:order_id', AuthMiddleware.authorize('ADMIN', 'MANAGER'), zodValidator({ schema: deleteOrderSchema, source: 'params' }), deleteOrderController);

export default router;
