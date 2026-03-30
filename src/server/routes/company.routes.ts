import { Router, Request, Response } from 'express';
import { getCompanyController, upsertCompanyController } from '../../controllers/company';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { upsertCompanySchema } from '../../core/application/dto/company.dto';
import { AuthMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Health check — sin autenticación
router.get('/ping', (_req: Request, res: Response) => {
  res.json({ ok: true, message: 'company route loaded' });
});

router.use(AuthMiddleware.authenticate);

router.get('/', getCompanyController);
router.put('/', zodValidator({ schema: upsertCompanySchema, source: 'body' }), upsertCompanyController);

export default router;
