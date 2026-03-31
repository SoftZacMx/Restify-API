import { Router } from 'express';
import {
  createExpenseController,
  getExpenseController,
  listExpensesController,
  updateExpenseController,
  deleteExpenseController,
} from '../../controllers/expenses';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { createExpenseSchema, getExpenseSchema, listExpensesSchema, updateExpenseSchema } from '../../core/application/dto/expense.dto';
import { AuthMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(AuthMiddleware.authenticate);
router.use(AuthMiddleware.authorize('ADMIN', 'MANAGER'));

router.post('/', zodValidator({ schema: createExpenseSchema, source: 'body' }), createExpenseController);
router.get('/', zodValidator({ schema: listExpensesSchema, source: 'query' }), listExpensesController);
router.get('/:expense_id', zodValidator({ schema: getExpenseSchema, source: 'params' }), getExpenseController);
router.put('/:expense_id', zodValidator({ schema: updateExpenseSchema, source: 'body' }), updateExpenseController);
router.delete('/:expense_id', zodValidator({ schema: getExpenseSchema, source: 'params' }), deleteExpenseController);

export default router;
