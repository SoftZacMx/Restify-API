import { Router } from 'express';
import { getReportsSummaryController } from '../../controllers/reports/get-reports-summary.controller';
import { generateReportController } from '../../controllers/reports/generate-report.controller';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { generateReportSchema } from '../../core/application/dto/report.dto';
import { AuthMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(AuthMiddleware.authenticate);
router.use(AuthMiddleware.authorize('ADMIN', 'MANAGER'));

router.get('/summary', getReportsSummaryController);
router.get('/', zodValidator({ schema: generateReportSchema, source: 'query' }), generateReportController);

export default router;
