import { UpdateEmployeeSalaryPaymentUseCase } from '../../core/application/use-cases/employee-salary-payments/update-employee-salary-payment.use-case';
import { makeController } from '../../shared/utils/make-controller';

export const updateEmployeeSalaryPaymentController = makeController(UpdateEmployeeSalaryPaymentUseCase, {
  mapper: (req) => [req.params.employee_salary_payment_id, req.body],
});
