import { inject, injectable } from 'tsyringe';
import { IEmployeeSalaryPaymentRepository } from '../../../domain/interfaces/employee-salary-payment-repository.interface';
import { GetEmployeeSalaryPaymentInput } from '../../dto/employee-salary-payment.dto';
import { AppError } from '../../../../shared/errors';

export interface GetEmployeeSalaryPaymentResult {
  id: string;
  userId: string;
  amount: number;
  paymentMethod: number;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
}

@injectable()
export class GetEmployeeSalaryPaymentUseCase {
  constructor(
    @inject('IEmployeeSalaryPaymentRepository')
    private readonly employeeSalaryPaymentRepository: IEmployeeSalaryPaymentRepository
  ) {}

  async execute(
    input: GetEmployeeSalaryPaymentInput
  ): Promise<GetEmployeeSalaryPaymentResult> {
    const payment = await this.employeeSalaryPaymentRepository.findById(
      input.employee_salary_payment_id
    );

    if (!payment) {
      throw new AppError('EMPLOYEE_SALARY_PAYMENT_NOT_FOUND');
    }

    return {
      id: payment.id,
      userId: payment.userId,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      date: payment.date,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
  }
}

