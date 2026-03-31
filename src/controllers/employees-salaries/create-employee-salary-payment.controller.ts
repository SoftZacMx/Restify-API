import { CreateEmployeeSalaryPaymentUseCase } from '../../core/application/use-cases/employee-salary-payments/create-employee-salary-payment.use-case';
import { makeBodyController } from '../../shared/utils/make-controller';

export const createEmployeeSalaryPaymentController = makeBodyController(CreateEmployeeSalaryPaymentUseCase);
