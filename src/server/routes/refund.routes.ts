import { Router, Request, Response } from 'express';
import {
  createRefundHandler,
  createStripeRefundHandler,
  getRefundHandler,
  listRefundsHandler,
  processStripeRefundHandler,
} from '../../handlers/refunds';
import { HttpToLambdaAdapter } from '../../shared/utils/http-to-lambda.adapter';
import { AuthMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Apply authentication to all routes
router.use(AuthMiddleware.authenticate);

// Refund routes
router.post('/', async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req);
    const context = HttpToLambdaAdapter.createContext();
    const response = await createRefundHandler(event as any, context);
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('Create refund route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred processing the refund request',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

router.post('/stripe', async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req);
    const context = HttpToLambdaAdapter.createContext();
    const response = await createStripeRefundHandler(event as any, context);
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('Create stripe refund route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred processing the stripe refund request',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

router.post('/stripe/process', async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req);
    const context = HttpToLambdaAdapter.createContext();
    const response = await processStripeRefundHandler(event as any, context);
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('Process stripe refund route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred processing the stripe refund confirmation',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

// Refund queries - NOTE: list must come before :refund_id
router.get('/', async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req);
    const context = HttpToLambdaAdapter.createContext();
    const response = await listRefundsHandler(event as any, context);
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('List refunds route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred processing the list refunds request',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

router.get('/:refund_id', async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req, { refund_id: req.params.refund_id });
    const context = HttpToLambdaAdapter.createContext();
    const response = await getRefundHandler(event as any, context);
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('Get refund route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred processing the get refund request',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;

