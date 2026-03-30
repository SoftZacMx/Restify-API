import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { CreateExpenseUseCase } from '../../core/application/use-cases/expenses/create-expense.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const createExpenseController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validatedData = req.body;

    const createExpenseUseCase = container.resolve(CreateExpenseUseCase);
    const result = await createExpenseUseCase.execute(validatedData);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
