import { ListExpensesUseCase } from '../../core/application/use-cases/expenses/list-expenses.use-case';
import { makeQueryController } from '../../shared/utils/make-controller';

export const listExpensesController = makeQueryController(ListExpensesUseCase);
