import { GetExpenseUseCase } from '../../core/application/use-cases/expenses/get-expense.use-case';
import { makeParamsController } from '../../shared/utils/make-controller';

export const getExpenseController = makeParamsController(GetExpenseUseCase);
