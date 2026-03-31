import { DeleteExpenseUseCase } from '../../core/application/use-cases/expenses/delete-expense.use-case';
import { makeDeleteController } from '../../shared/utils/make-controller';

export const deleteExpenseController = makeDeleteController(DeleteExpenseUseCase, 'Expense deleted successfully');
