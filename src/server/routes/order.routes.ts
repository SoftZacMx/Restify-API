import { Router, Request, Response } from 'express';
import { createOrderHandler } from '../../handlers/orders/create-order.handler';
import { getOrderHandler } from '../../handlers/orders/get-order.handler';
import { listOrdersHandler } from '../../handlers/orders/list-orders.handler';
import { updateOrderHandler } from '../../handlers/orders/update-order.handler';
import { deleteOrderHandler } from '../../handlers/orders/delete-order.handler';
import { HttpToLambdaAdapter } from '../../shared/utils/http-to-lambda.adapter';
import { AuthMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Apply authentication to all routes
router.use(AuthMiddleware.authenticate);

/**
 * POST /api/orders
 * Create order endpoint
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req);
    const context = HttpToLambdaAdapter.createContext();
    const response = await createOrderHandler(event as any, context);
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('Create order route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred processing the create order request',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/orders
 * List orders endpoint (with optional filters)
 * NOTE: This must come before /:order_id route
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req);
    const context = HttpToLambdaAdapter.createContext();
    const response = await listOrdersHandler(event as any, context);
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('List orders route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred processing the list orders request',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/orders/:order_id
 * Get order by ID endpoint
 */
router.get('/:order_id', async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req, { order_id: req.params.order_id });
    const context = HttpToLambdaAdapter.createContext();
    const response = await getOrderHandler(event as any, context);
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('Get order route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred processing the get order request',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * PUT /api/orders/:order_id
 * Update order endpoint
 */
router.put('/:order_id', async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req, { order_id: req.params.order_id });
    const context = HttpToLambdaAdapter.createContext();
    const response = await updateOrderHandler(event as any, context);
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('Update order route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred processing the update order request',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * DELETE /api/orders/:order_id
 * Delete order endpoint
 */
router.delete('/:order_id', async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req, { order_id: req.params.order_id });
    const context = HttpToLambdaAdapter.createContext();
    const response = await deleteOrderHandler(event as any, context);
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('Delete order route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred processing the delete order request',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;

