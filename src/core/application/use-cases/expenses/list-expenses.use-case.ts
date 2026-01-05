import { inject, injectable } from 'tsyringe';
import { IExpenseRepository } from '../../../domain/interfaces/expense-repository.interface';
import { ListExpensesInput } from '../../dto/expense.dto';

export interface ListExpensesResult {
  data: Array<{
    id: string;
    type: string;
    date: Date;
    total: number;
    subtotal: number;
    iva: number;
    description: string | null;
    paymentMethod: number;
    userId: string;
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
export class ListExpensesUseCase {
  constructor(
    @inject('IExpenseRepository') private readonly expenseRepository: IExpenseRepository
  ) {}

  async execute(input?: ListExpensesInput): Promise<ListExpensesResult> {
    const filters = input
      ? {
          type: input.type,
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
    const [expenses, total] = await Promise.all([
      this.expenseRepository.findAll(filters, { skip, take }),
      this.expenseRepository.count(filters),
    ]);

    const totalPages = Math.ceil(total / take);

    return {
      data: expenses.map((expense) => ({
        id: expense.id,
        type: expense.type,
        date: expense.date,
        total: expense.total,
        subtotal: expense.subtotal,
        iva: expense.iva,
        description: expense.description,
        paymentMethod: expense.paymentMethod,
        userId: expense.userId,
        createdAt: expense.createdAt,
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

