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
} from '../../controllers/orders';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { createOrderSchema, listOrdersSchema, getOrderSchema, deleteOrderSchema } from '../../core/application/dto/order.dto';
import { payOrderSchema } from '../../core/application/dto/payment.dto';
import { AuthMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(AuthMiddleware.authenticate);

/** POST /api/orders */
router.post('/', zodValidator({ schema: createOrderSchema, source: 'body' }), createOrderController);

/** GET /api/orders */
router.get('/', zodValidator({ schema: listOrdersSchema, source: 'query' }), listOrdersController);

/** POST /api/orders/:order_id/pay */
router.post('/:order_id/pay', zodValidator({ schema: payOrderSchema, source: 'body' }), (req, res, next) => {
  req.body = { ...req.body, orderId: req.params.order_id };
  payOrderController(req, res, next);
});

/** GET /api/orders/:order_id/ticket/kitchen-ticket */
router.get('/:order_id/ticket/kitchen-ticket', zodValidator({ schema: getOrderSchema, source: 'params' }), getKitchenTicketController);

/** GET /api/orders/:order_id/ticket/sale-ticket */
router.get('/:order_id/ticket/sale-ticket', zodValidator({ schema: getOrderSchema, source: 'params' }), getSaleTicketController);

/** GET /api/orders/:order_id */
router.get('/:order_id', zodValidator({ schema: getOrderSchema, source: 'params' }), getOrderController);

/** PUT /api/orders/:order_id */
router.put('/:order_id', updateOrderController);

/** DELETE /api/orders/:order_id */
router.delete('/:order_id', zodValidator({ schema: deleteOrderSchema, source: 'params' }), deleteOrderController);

export default router;
