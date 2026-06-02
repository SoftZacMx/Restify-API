import { DeleteExpenseUseCase } from '../../core/application/use-cases/expenses/delete-expense.use-case';
import { makeController } from '../../shared/utils/make-controller';

export const deleteExpenseController = makeController(DeleteExpenseUseCase, {
  mapper: (req) => req.params,
  responseMapper: () => ({ message: 'Expense deleted successfully' }),
});
