import { Router, Request, Response } from 'express';
import { getDashboardHandler } from '../../handlers/dashboard';
import { HttpToLambdaAdapter } from '../../shared/utils/http-to-lambda.adapter';
import { AuthMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(AuthMiddleware.authenticate);

router.get('/', async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req);
    const context = HttpToLambdaAdapter.createContext();
    const response = await getDashboardHandler(event as any, context);
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('Get dashboard route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred processing the dashboard request',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
