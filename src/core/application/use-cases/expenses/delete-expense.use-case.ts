import { inject, injectable } from 'tsyringe';
import { IExpenseRepository } from '../../../domain/interfaces/expense-repository.interface';
import { AppError } from '../../../../shared/errors';

export interface DeleteExpenseInput {
  expense_id: string;
}

@injectable()
export class DeleteExpenseUseCase {
  constructor(
    @inject('IExpenseRepository') private readonly expenseRepository: IExpenseRepository
  ) {}

  async execute(input: DeleteExpenseInput): Promise<void> {
    // Check if expense exists
    const expense = await this.expenseRepository.findById(input.expense_id);
    if (!expense) {
      throw new AppError('EXPENSE_NOT_FOUND');
    }

    // Delete expense (items will be deleted automatically due to onDelete: Cascade)
    await this.expenseRepository.delete(input.expense_id);
  }
}

