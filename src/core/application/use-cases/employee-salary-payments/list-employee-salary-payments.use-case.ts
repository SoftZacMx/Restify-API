import { inject, injectable } from 'tsyringe';
import { IEmployeeSalaryPaymentRepository } from '../../../domain/interfaces/employee-salary-payment-repository.interface';
import { ListEmployeeSalaryPaymentsInput } from '../../dto/employee-salary-payment.dto';

export interface ListEmployeeSalaryPaymentsResult {
  data: Array<{
    id: string;
    userId: string;
    amount: number;
    paymentMethod: number;
    date: Date;
    createdAt: Date;
  }>;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

@injectable()
export class ListEmployeeSalaryPaymentsUseCase {
  constructor(
    @inject('IEmployeeSalaryPaymentRepository')
    private readonly employeeSalaryPaymentRepository: IEmployeeSalaryPaymentRepository
  ) {}

  async execute(
    input?: ListEmployeeSalaryPaymentsInput
  ): Promise<ListEmployeeSalaryPaymentsResult> {
    const filters = input
      ? {
          userId: input.userId,
          paymentMethod: input.paymentMethod,
          dateFrom: input.dateFrom ? new Date(input.dateFrom) : undefined,
          dateTo: input.dateTo ? new Date(input.dateTo) : undefined,
        }
      : undefined;

    // Pagination defaults
    const page = input?.page || 1;
    const pageSize = input?.pageSize || 20;
    const skip = (page - 1) * pageSize;
    const take = Math.min(pageSize, 100); // Max 100 items per page

    // Get total count and paginated results
    const [payments, total] = await Promise.all([
      this.employeeSalaryPaymentRepository.findAll(filters, { skip, take }),
      this.employeeSalaryPaymentRepository.count(filters),
    ]);

    const totalPages = Math.ceil(total / take);

    return {
      data: payments.map((payment) => ({
        id: payment.id,
        userId: payment.userId,
        amount: payment.amount,
        paymentMethod: payment.paymentMethod,
        date: payment.date,
        createdAt: payment.createdAt,
      })),
      pagination: {
        page,
        pageSize: take,
        total,
        totalPages,
      },
    };
  }
}

