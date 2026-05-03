import { Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { DeleteExpenseUseCase } from '../../core/application/use-cases/expenses/delete-expense.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';
import { AppError } from '../../shared/errors';
import { AuthenticatedRequest } from '../../server/middleware/auth.middleware';

export const deleteExpenseController = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('UNAUTHORIZED', 'Authenticated user is required to delete an expense');
    }

    const useCase = container.resolve(DeleteExpenseUseCase);
    await useCase.execute({ expense_id: req.params.expense_id, userId });
    sendSuccess(res, { message: 'Expense deleted successfully' });
  } catch (error) {
    next(error);
  }
};
