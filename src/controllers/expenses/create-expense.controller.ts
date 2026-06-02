import { CreateExpenseUseCase } from '../../core/application/use-cases/expenses/create-expense.use-case';
import { makeController } from '../../shared/utils/make-controller';

export const createExpenseController = makeController(CreateExpenseUseCase);
