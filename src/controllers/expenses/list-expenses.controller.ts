import { ListExpensesUseCase } from '../../core/application/use-cases/expenses/list-expenses.use-case';
import { makeController } from '../../shared/utils/make-controller';

export const listExpensesController = makeController(ListExpensesUseCase, {
  mapper: (req) => req.query,
});
