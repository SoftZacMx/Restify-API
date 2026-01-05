import { inject, injectable } from 'tsyringe';
import { IEmployeeSalaryPaymentRepository } from '../../../domain/interfaces/employee-salary-payment-repository.interface';
import { IUserRepository } from '../../../domain/interfaces/user-repository.interface';
import { CreateEmployeeSalaryPaymentInput } from '../../dto/employee-salary-payment.dto';
import { AppError } from '../../../../shared/errors';

export interface CreateEmployeeSalaryPaymentResult {
  id: string;
  userId: string;
  amount: number;
  paymentMethod: number;
  date: Date;
  createdAt: Date;
}

@injectable()
export class CreateEmployeeSalaryPaymentUseCase {
  constructor(
    @inject('IEmployeeSalaryPaymentRepository')
    private readonly employeeSalaryPaymentRepository: IEmployeeSalaryPaymentRepository,
    @inject('IUserRepository') private readonly userRepository: IUserRepository
  ) {}

  async execute(
    input: CreateEmployeeSalaryPaymentInput
  ): Promise<CreateEmployeeSalaryPaymentResult> {
    // Validate that user exists
    const user = await this.userRepository.findById(input.userId);
    if (!user) {
      throw new AppError('USER_NOT_FOUND');
    }

    // Create employee salary payment
    const payment = await this.employeeSalaryPaymentRepository.create({
      userId: input.userId,
      amount: input.amount,
      paymentMethod: input.paymentMethod,
      date: input.date ? new Date(input.date) : new Date(),
    });

    return {
      id: payment.id,
      userId: payment.userId,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      date: payment.date,
      createdAt: payment.createdAt,
    };
  }
}

