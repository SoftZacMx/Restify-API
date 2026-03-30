import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { CreateEmployeeSalaryPaymentUseCase } from '../../core/application/use-cases/employee-salary-payments/create-employee-salary-payment.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const createEmployeeSalaryPaymentController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validatedData = req.body;

    const createEmployeeSalaryPaymentUseCase = container.resolve(
      CreateEmployeeSalaryPaymentUseCase
    );
    const result = await createEmployeeSalaryPaymentUseCase.execute(validatedData);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
