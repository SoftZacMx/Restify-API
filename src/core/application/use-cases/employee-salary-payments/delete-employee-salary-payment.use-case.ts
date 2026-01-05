import { inject, injectable } from 'tsyringe';
import { IEmployeeSalaryPaymentRepository } from '../../../domain/interfaces/employee-salary-payment-repository.interface';
import { AppError } from '../../../../shared/errors';

export interface DeleteEmployeeSalaryPaymentInput {
  employee_salary_payment_id: string;
}

@injectable()
export class DeleteEmployeeSalaryPaymentUseCase {
  constructor(
    @inject('IEmployeeSalaryPaymentRepository')
    private readonly employeeSalaryPaymentRepository: IEmployeeSalaryPaymentRepository
  ) {}

  async execute(input: DeleteEmployeeSalaryPaymentInput): Promise<void> {
    // Check if payment exists
    const payment = await this.employeeSalaryPaymentRepository.findById(
      input.employee_salary_payment_id
    );
    if (!payment) {
      throw new AppError('EMPLOYEE_SALARY_PAYMENT_NOT_FOUND');
    }

    // Delete payment
    await this.employeeSalaryPaymentRepository.delete(
      input.employee_salary_payment_id
    );
  }
}

