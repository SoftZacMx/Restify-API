import { ListEmployeeSalaryPaymentsUseCase } from '../../core/application/use-cases/employee-salary-payments/list-employee-salary-payments.use-case';
import { makeQueryController } from '../../shared/utils/make-controller';

export const listEmployeeSalaryPaymentsController = makeQueryController(ListEmployeeSalaryPaymentsUseCase);
