import { UpdateEmployeeSalaryPaymentUseCase } from '../../core/application/use-cases/employee-salary-payments/update-employee-salary-payment.use-case';
import { makeParamBodyController } from '../../shared/utils/make-controller';

export const updateEmployeeSalaryPaymentController = makeParamBodyController(UpdateEmployeeSalaryPaymentUseCase, 'employee_salary_payment_id');
