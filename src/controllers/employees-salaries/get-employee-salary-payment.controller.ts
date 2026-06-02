import { GetEmployeeSalaryPaymentUseCase } from '../../core/application/use-cases/employee-salary-payments/get-employee-salary-payment.use-case';
import { makeController } from '../../shared/utils/make-controller';

export const getEmployeeSalaryPaymentController = makeController(GetEmployeeSalaryPaymentUseCase, {
  mapper: (req) => req.params,
});
