import { inject, injectable } from 'tsyringe';
import { IExpenseRepository } from '../../../domain/interfaces/expense-repository.interface';
import { GetExpenseInput } from '../../dto/expense.dto';
import { AppError } from '../../../../shared/errors';

export interface GetExpenseResult {
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
  updatedAt: Date;
  items?: Array<{
    id: string;
    productId: string;
    amount: number;
    subtotal: number;
    total: number;
    unitOfMeasure: string | null;
  }>;
}

@injectable()
export class GetExpenseUseCase {
  constructor(
    @inject('IExpenseRepository') private readonly expenseRepository: IExpenseRepository
  ) {}

  async execute(input: GetExpenseInput): Promise<GetExpenseResult> {
    const expense = await this.expenseRepository.findById(input.expense_id);

    if (!expense) {
      throw new AppError('EXPENSE_NOT_FOUND');
    }

    // Only fetch items if type is MERCHANDISE
    const items = expense.isMerchandise()
      ? await this.expenseRepository.findItemsByExpenseId(expense.id)
      : [];

    return {
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
      updatedAt: expense.updatedAt,
      items: items.map((item) => ({
        id: item.id,
        productId: item.productId,
        amount: item.amount,
        subtotal: item.subtotal,
        total: item.total,
        unitOfMeasure: item.unitOfMeasure,
      })),
    };
  }
}

