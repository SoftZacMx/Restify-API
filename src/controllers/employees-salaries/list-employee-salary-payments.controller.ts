import { ListEmployeeSalaryPaymentsUseCase } from '../../core/application/use-cases/employee-salary-payments/list-employee-salary-payments.use-case';
import { makeController } from '../../shared/utils/make-controller';

export const listEmployeeSalaryPaymentsController = makeController(ListEmployeeSalaryPaymentsUseCase, {
  mapper: (req) => req.query,
});
