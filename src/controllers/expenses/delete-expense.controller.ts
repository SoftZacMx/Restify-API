import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { DeleteExpenseUseCase } from '../../core/application/use-cases/expenses/delete-expense.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const deleteExpenseController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const expense_id = req.params.expense_id;
    const validatedData = { expense_id };

    const deleteExpenseUseCase = container.resolve(DeleteExpenseUseCase);
    await deleteExpenseUseCase.execute(validatedData);

    sendSuccess(res, { message: 'Expense deleted successfully' });
  } catch (error) {
    next(error);
  }
};
