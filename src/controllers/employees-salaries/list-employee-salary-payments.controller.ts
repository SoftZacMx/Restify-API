import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { ListEmployeeSalaryPaymentsUseCase } from '../../core/application/use-cases/employee-salary-payments/list-employee-salary-payments.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const listEmployeeSalaryPaymentsController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const queryParams = req.query || {};
    const validatedData = queryParams as any;

    const listEmployeeSalaryPaymentsUseCase = container.resolve(
      ListEmployeeSalaryPaymentsUseCase
    );
    const result = await listEmployeeSalaryPaymentsUseCase.execute(validatedData);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
