import { Router } from 'express';
import {
  listStockAlertsController,
  listMovementsController,
  recordWasteController,
  recordAdjustmentController,
} from '../../controllers/stock';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import {
  listMovementsQuerySchema,
  recordWasteSchema,
  recordAdjustmentSchema,
} from '../../core/application/dto/stock.dto';
import { AuthMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(AuthMiddleware.authenticate);

// Lecturas (cualquier autenticado)
router.get('/alerts', listStockAlertsController);
router.get(
  '/movements',
  zodValidator({ schema: listMovementsQuerySchema, source: 'query' }),
  listMovementsController
);

// Mutaciones (OWNER+)
router.post(
  '/waste',
  AuthMiddleware.authorize('OWNER', 'ADMIN', 'MANAGER'),
  zodValidator({ schema: recordWasteSchema, source: 'body' }),
  recordWasteController
);
router.post(
  '/adjust',
  AuthMiddleware.authorize('OWNER', 'ADMIN', 'MANAGER'),
  zodValidator({ schema: recordAdjustmentSchema, source: 'body' }),
  recordAdjustmentController
);

export default router;
