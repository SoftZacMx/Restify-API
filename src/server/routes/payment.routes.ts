import { Router, Request, Response } from 'express';
import {
  payOrderWithCashHandler,
  payOrderWithTransferHandler,
  payOrderWithCardPhysicalHandler,
  payOrderWithCardStripeHandler,
  payOrderWithSplitPaymentHandler,
  confirmStripePaymentHandler,
  getPaymentHandler,
  listPaymentsHandler,
  getPaymentSessionHandler,
} from '../../handlers/payments';
import { HttpToLambdaAdapter } from '../../shared/utils/http-to-lambda.adapter';
import { AuthMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Apply authentication to all routes (except webhook endpoints if needed)
router.use(AuthMiddleware.authenticate);

// Payment routes
router.post('/cash', async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req);
    const context = HttpToLambdaAdapter.createContext();
    const response = await payOrderWithCashHandler(event as any, context);
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('Pay order with cash route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred processing the payment request',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

router.post('/transfer', async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req);
    const context = HttpToLambdaAdapter.createContext();
    const response = await payOrderWithTransferHandler(event as any, context);
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('Pay order with transfer route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred processing the payment request',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

router.post('/card-physical', async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req);
    const context = HttpToLambdaAdapter.createContext();
    const response = await payOrderWithCardPhysicalHandler(event as any, context);
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('Pay order with card physical route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred processing the payment request',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

router.post('/card-stripe', async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req);
    const context = HttpToLambdaAdapter.createContext();
    const response = await payOrderWithCardStripeHandler(event as any, context);
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('Pay order with card stripe route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred processing the payment request',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

router.post('/split', async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req);
    const context = HttpToLambdaAdapter.createContext();
    const response = await payOrderWithSplitPaymentHandler(event as any, context);
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('Pay order with split payment route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred processing the payment request',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

router.post('/stripe/confirm', async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req);
    const context = HttpToLambdaAdapter.createContext();
    const response = await confirmStripePaymentHandler(event as any, context);
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('Confirm stripe payment route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred processing the payment confirmation',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

// Payment queries - NOTE: list must come before :payment_id
router.get('/', async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req);
    const context = HttpToLambdaAdapter.createContext();
    const response = await listPaymentsHandler(event as any, context);
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('List payments route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred processing the list payments request',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

router.get('/:payment_id', async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req, { payment_id: req.params.payment_id });
    const context = HttpToLambdaAdapter.createContext();
    const response = await getPaymentHandler(event as any, context);
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('Get payment route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred processing the get payment request',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

router.get('/:payment_id/session', async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req, { payment_id: req.params.payment_id });
    const context = HttpToLambdaAdapter.createContext();
    const response = await getPaymentSessionHandler(event as any, context);
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('Get payment session route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred processing the get payment session request',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;

