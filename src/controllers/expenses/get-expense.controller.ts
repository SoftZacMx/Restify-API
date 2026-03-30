import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { GetExpenseUseCase } from '../../core/application/use-cases/expenses/get-expense.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const getExpenseController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const expense_id = req.params.expense_id;
    const validatedData = { expense_id };

    const getExpenseUseCase = container.resolve(GetExpenseUseCase);
    const result = await getExpenseUseCase.execute(validatedData);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
