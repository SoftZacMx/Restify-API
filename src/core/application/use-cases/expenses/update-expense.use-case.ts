import { inject, injectable } from 'tsyringe';
import { IExpenseRepository } from '../../../domain/interfaces/expense-repository.interface';
import { UpdateExpenseInput } from '../../dto/expense.dto';
import { AppError } from '../../../../shared/errors';

export interface UpdateExpenseResult {
  id: string;
  title: string;
  type: string;
  date: Date;
  total: number;
  subtotal: number;
  iva: number;
  description: string | null;
  paymentMethod: number;
  userId: string | null;
  paymentId: string | null;
  updatedAt: Date;
}

@injectable()
export class UpdateExpenseUseCase {
  constructor(
    @inject('IExpenseRepository') private readonly expenseRepository: IExpenseRepository
  ) {}

  async execute(expenseId: string, input: UpdateExpenseInput): Promise<UpdateExpenseResult> {
    // 1. Check if expense exists
    const existingExpense = await this.expenseRepository.findById(expenseId);
    if (!existingExpense) {
      throw new AppError('EXPENSE_NOT_FOUND');
    }

    // 2. Prepare update data
    const updateData: any = {};
    if (input.title !== undefined) updateData.title = input.title;
    if (input.date !== undefined) updateData.date = new Date(input.date);
    if (input.total !== undefined) updateData.total = input.total;
    if (input.subtotal !== undefined) updateData.subtotal = input.subtotal;
    if (input.iva !== undefined) updateData.iva = input.iva;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.paymentMethod !== undefined) updateData.paymentMethod = input.paymentMethod;

    // 3. Update expense
    const updatedExpense = await this.expenseRepository.update(expenseId, updateData);

    return {
      id: updatedExpense.id,
      title: updatedExpense.title,
      type: updatedExpense.type,
      date: updatedExpense.date,
      total: updatedExpense.total,
      subtotal: updatedExpense.subtotal,
      iva: updatedExpense.iva,
      description: updatedExpense.description,
      paymentMethod: updatedExpense.paymentMethod,
      userId: updatedExpense.userId,
      paymentId: updatedExpense.paymentId,
      updatedAt: updatedExpense.updatedAt,
    };
  }
}

