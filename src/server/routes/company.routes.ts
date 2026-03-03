import { Router, Request, Response } from 'express';
import { getCompanyHandler, upsertCompanyHandler } from '../../handlers/company';
import { HttpToLambdaAdapter } from '../../shared/utils/http-to-lambda.adapter';
import { AuthMiddleware } from '../middleware/auth.middleware';

const router = Router();

/** GET /api/company/ping - sin auth, para comprobar que la ruta existe */
router.get('/ping', (_req: Request, res: Response) => {
  res.json({ ok: true, message: 'company route loaded' });
});

router.use(AuthMiddleware.authenticate);

/**
 * GET /api/company
 * Obtiene la información de la empresa (singleton). 404 si no existe.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req);
    const context = HttpToLambdaAdapter.createContext();
    const response = await getCompanyHandler(event as any, context);
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('Get company route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred processing the get company request',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

const upsertCompanyRoute = async (req: Request, res: Response) => {
  try {
    const event = HttpToLambdaAdapter.convertRequest(req);
    const context = HttpToLambdaAdapter.createContext();
    const response = await upsertCompanyHandler(event as any, context);
    HttpToLambdaAdapter.convertResponse(response, res);
  } catch (error) {
    console.error('Upsert company route error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROUTE_ERROR',
        message: 'An error occurred processing the upsert company request',
      },
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * PUT /api/company
 * Crea o actualiza la información de la empresa (upsert). Body: name, state, city, street, exteriorNumber, phone, rfc?, logoUrl?
 */
router.put('/', upsertCompanyRoute);
router.put('', upsertCompanyRoute);

export default router;
