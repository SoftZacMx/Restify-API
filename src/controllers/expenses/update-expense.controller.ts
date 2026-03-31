import { UpdateExpenseUseCase } from '../../core/application/use-cases/expenses/update-expense.use-case';
import { makeParamBodyController } from '../../shared/utils/make-controller';

export const updateExpenseController = makeParamBodyController(UpdateExpenseUseCase, 'expense_id');
