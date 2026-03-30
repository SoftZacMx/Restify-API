import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { UpdateExpenseUseCase } from '../../core/application/use-cases/expenses/update-expense.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const updateExpenseController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const expense_id = req.params.expense_id;
    const validatedBody = req.body;

    const updateExpenseUseCase = container.resolve(UpdateExpenseUseCase);
    const result = await updateExpenseUseCase.execute(expense_id, validatedBody);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
