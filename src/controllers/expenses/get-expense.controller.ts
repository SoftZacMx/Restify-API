import { GetExpenseUseCase } from '../../core/application/use-cases/expenses/get-expense.use-case';
import { makeController } from '../../shared/utils/make-controller';

export const getExpenseController = makeController(GetExpenseUseCase, {
  mapper: (req) => req.params,
});
