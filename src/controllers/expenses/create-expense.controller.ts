import { CreateExpenseUseCase } from '../../core/application/use-cases/expenses/create-expense.use-case';
import { makeBodyController } from '../../shared/utils/make-controller';

export const createExpenseController = makeBodyController(CreateExpenseUseCase);
