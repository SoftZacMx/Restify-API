import { Router } from 'express';
import { getReportsSummaryController } from '../../controllers/reports/get-reports-summary.controller';
import { generateReportController } from '../../controllers/reports/generate-report.controller';
import {
  wasteReportController,
  productsConsumptionReportController,
  menuItemsCostReportController,
} from '../../controllers/stock';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { generateReportSchema } from '../../core/application/dto/report.dto';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { MANAGER_AND_UP } from '../../shared/constants/roles.constants';

const router = Router();

router.use(AuthMiddleware.authenticate);
router.use(AuthMiddleware.authorize(...MANAGER_AND_UP));

router.get('/summary', getReportsSummaryController);

// Reportes de stock (Fase 5.3 / 8)
router.get('/waste', wasteReportController);
router.get('/products/consumption', productsConsumptionReportController);
router.get('/menu-items/cost', menuItemsCostReportController);

router.get('/', zodValidator({ schema: generateReportSchema, source: 'query' }), generateReportController);

export default router;
