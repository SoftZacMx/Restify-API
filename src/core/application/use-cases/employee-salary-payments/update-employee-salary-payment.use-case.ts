import { inject, injectable } from 'tsyringe';
import { IEmployeeSalaryPaymentRepository } from '../../../domain/interfaces/employee-salary-payment-repository.interface';
import { UpdateEmployeeSalaryPaymentInput } from '../../dto/employee-salary-payment.dto';
import { AppError } from '../../../../shared/errors';

export interface UpdateEmployeeSalaryPaymentResult {
  id: string;
  userId: string;
  amount: number;
  paymentMethod: number;
  date: Date;
  updatedAt: Date;
}

@injectable()
export class UpdateEmployeeSalaryPaymentUseCase {
  constructor(
    @inject('IEmployeeSalaryPaymentRepository')
    private readonly employeeSalaryPaymentRepository: IEmployeeSalaryPaymentRepository
  ) {}

  async execute(
    paymentId: string,
    input: UpdateEmployeeSalaryPaymentInput
  ): Promise<UpdateEmployeeSalaryPaymentResult> {
    // Check if payment exists
    const existingPayment = await this.employeeSalaryPaymentRepository.findById(
      paymentId
    );
    if (!existingPayment) {
      throw new AppError('EMPLOYEE_SALARY_PAYMENT_NOT_FOUND');
    }

    // Prepare update data
    const updateData: any = {};
    if (input.amount !== undefined) updateData.amount = input.amount;
    if (input.paymentMethod !== undefined)
      updateData.paymentMethod = input.paymentMethod;
    if (input.date !== undefined) updateData.date = new Date(input.date);

    // Update payment
    const updatedPayment = await this.employeeSalaryPaymentRepository.update(
      paymentId,
      updateData
    );

    return {
      id: updatedPayment.id,
      userId: updatedPayment.userId,
      amount: updatedPayment.amount,
      paymentMethod: updatedPayment.paymentMethod,
      date: updatedPayment.date,
      updatedAt: updatedPayment.updatedAt,
    };
  }
}

