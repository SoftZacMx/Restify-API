import { Router } from 'express';
import {
  createRefundController,
  createStripeRefundController,
  processStripeRefundController,
  listRefundsController,
  getRefundController,
} from '../../controllers/refunds';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { createRefundSchema, getRefundSchema, listRefundsSchema, processStripeRefundSchema } from '../../core/application/dto/refund.dto';
import { AuthMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(AuthMiddleware.authenticate);
router.use(AuthMiddleware.authorize('ADMIN', 'MANAGER'));

router.post('/', zodValidator({ schema: createRefundSchema, source: 'body' }), createRefundController);
router.post('/stripe', zodValidator({ schema: createRefundSchema, source: 'body' }), createStripeRefundController);
router.post('/stripe/process', zodValidator({ schema: processStripeRefundSchema, source: 'body' }), processStripeRefundController);
router.get('/', zodValidator({ schema: listRefundsSchema, source: 'query' }), listRefundsController);
router.get('/:refund_id', zodValidator({ schema: getRefundSchema, source: 'params' }), getRefundController);

export default router;
