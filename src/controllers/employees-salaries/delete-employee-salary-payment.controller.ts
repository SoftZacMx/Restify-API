import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { DeleteEmployeeSalaryPaymentUseCase } from '../../core/application/use-cases/employee-salary-payments/delete-employee-salary-payment.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const deleteEmployeeSalaryPaymentController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const employee_salary_payment_id = req.params.employee_salary_payment_id;
    const validatedData = {
      employee_salary_payment_id: employee_salary_payment_id!,
    };

    const deleteEmployeeSalaryPaymentUseCase = container.resolve(
      DeleteEmployeeSalaryPaymentUseCase
    );
    await deleteEmployeeSalaryPaymentUseCase.execute(validatedData);

    sendSuccess(res, { message: 'Employee salary payment deleted successfully' });
  } catch (error) {
    next(error);
  }
};
