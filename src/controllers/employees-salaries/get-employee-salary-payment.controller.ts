import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { GetEmployeeSalaryPaymentUseCase } from '../../core/application/use-cases/employee-salary-payments/get-employee-salary-payment.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const getEmployeeSalaryPaymentController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const employee_salary_payment_id = req.params.employee_salary_payment_id;
    const validatedData = {
      employee_salary_payment_id: employee_salary_payment_id!,
    };

    const getEmployeeSalaryPaymentUseCase = container.resolve(
      GetEmployeeSalaryPaymentUseCase
    );
    const result = await getEmployeeSalaryPaymentUseCase.execute(validatedData);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
