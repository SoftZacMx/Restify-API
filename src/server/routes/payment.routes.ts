import { Router, Request, Response } from 'express';
import {
  payOrderWithCashHandler,
  payOrderWithTransferHandler,
  payOrderWithCardPhysicalHandler,
  payOrderWithCardStripeHandler,
  confirmStripePaymentHandler,
  getPaymentHandler,
  listPaymentsHandler,
  getPaymentSessionHandler,
  payOrderWithQRMercadoPagoHandler,
  getQRPaymentStatusHandler,
  mercadoPagoWebhookHandler,
} from '../../handlers/payments';
import { HttpToLambdaAdapter } from '../../shared/utils/http-to-lambda.adapter';
import { AuthMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Webhook de Mercado Pago — sin autenticación (MP envía directamente)
router.post('/webhooks/mercado-pago', async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req);
    const context = HttpToLambdaAdapter.createContext();
    const response = await mercadoPagoWebhookHandler(event as any, context);
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('Mercado Pago webhook route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred processing the webhook',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

// Apply authentication to all routes below
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

router.post('/qr-mercado-pago', async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req);
    const context = HttpToLambdaAdapter.createContext();
    const response = await payOrderWithQRMercadoPagoHandler(event as any, context);
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('Pay order with QR Mercado Pago route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred processing the QR payment request',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

router.get('/qr-mercado-pago/:orderId', async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req, { orderId: req.params.orderId });
    const context = HttpToLambdaAdapter.createContext();
    const response = await getQRPaymentStatusHandler(event as any, context);
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('Get QR payment status route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred processing the QR payment status request',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

// Pago dividido: usar POST /api/orders/:order_id/pay con body { firstPayment, secondPayment }

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

