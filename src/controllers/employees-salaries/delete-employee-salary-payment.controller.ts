import { DeleteEmployeeSalaryPaymentUseCase } from '../../core/application/use-cases/employee-salary-payments/delete-employee-salary-payment.use-case';
import { makeDeleteController } from '../../shared/utils/make-controller';

export const deleteEmployeeSalaryPaymentController = makeDeleteController(DeleteEmployeeSalaryPaymentUseCase, 'Employee salary payment deleted successfully');
