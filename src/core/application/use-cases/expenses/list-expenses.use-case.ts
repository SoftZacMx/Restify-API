import { inject, injectable } from 'tsyringe';
import { IExpenseRepository } from '../../../domain/interfaces/expense-repository.interface';
import { ListExpensesInput } from '../../dto/expense.dto';

export interface ListExpensesResult {
  data: Array<{
    id: string;
    title: string;
    type: string;
    date: Date;
    total: number;
    subtotal: number;
    iva: number;
    description: string | null;
    paymentMethod: number;
    userId: string;
    /** Nombre completo del usuario (nombre + apellidos). Join con User. */
    userName: string;
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

    // Get total count and paginated results (findAllWithUser hace join con User)
    const [expenses, total] = await Promise.all([
      this.expenseRepository.findAllWithUser(filters, { skip, take }),
      this.expenseRepository.count(filters),
    ]);

    const totalPages = Math.ceil(total / take);

    const fullName = (u: { name: string; last_name: string; second_last_name: string | null }) =>
      [u.name, u.last_name, u.second_last_name].filter(Boolean).join(' ').trim();

    return {
      data: expenses.map((expense) => ({
        id: expense.id,
        title: expense.title,
        type: expense.type,
        date: expense.date,
        total: expense.total,
        subtotal: expense.subtotal,
        iva: expense.iva,
        description: expense.description,
        paymentMethod: expense.paymentMethod,
        userId: expense.userId,
        userName: fullName(expense.user),
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

