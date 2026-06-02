import { UpdateExpenseUseCase } from '../../core/application/use-cases/expenses/update-expense.use-case';
import { makeController } from '../../shared/utils/make-controller';

export const updateExpenseController = makeController(UpdateExpenseUseCase, {
  mapper: (req) => [req.params.expense_id, req.body],
});
