import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { UpdateEmployeeSalaryPaymentUseCase } from '../../core/application/use-cases/employee-salary-payments/update-employee-salary-payment.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const updateEmployeeSalaryPaymentController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const employee_salary_payment_id = req.params.employee_salary_payment_id;
    const validatedBody = req.body;

    const updateEmployeeSalaryPaymentUseCase = container.resolve(
      UpdateEmployeeSalaryPaymentUseCase
    );
    const result = await updateEmployeeSalaryPaymentUseCase.execute(
      employee_salary_payment_id!,
      validatedBody
    );

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
