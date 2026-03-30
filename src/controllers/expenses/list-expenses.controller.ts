import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { ListExpensesUseCase } from '../../core/application/use-cases/expenses/list-expenses.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const listExpensesController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const queryParams = req.query || {};
    const validatedData = queryParams as any;

    const listExpensesUseCase = container.resolve(ListExpensesUseCase);
    const result = await listExpensesUseCase.execute(validatedData);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
