import { GetEmployeeSalaryPaymentUseCase } from '../../core/application/use-cases/employee-salary-payments/get-employee-salary-payment.use-case';
import { makeParamsController } from '../../shared/utils/make-controller';

export const getEmployeeSalaryPaymentController = makeParamsController(GetEmployeeSalaryPaymentUseCase);
