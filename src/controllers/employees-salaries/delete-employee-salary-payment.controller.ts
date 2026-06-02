import { DeleteEmployeeSalaryPaymentUseCase } from '../../core/application/use-cases/employee-salary-payments/delete-employee-salary-payment.use-case';
import { makeController } from '../../shared/utils/make-controller';

export const deleteEmployeeSalaryPaymentController = makeController(DeleteEmployeeSalaryPaymentUseCase, {
  mapper: (req) => req.params,
  responseMapper: () => ({ message: 'Employee salary payment deleted successfully' }),
});
