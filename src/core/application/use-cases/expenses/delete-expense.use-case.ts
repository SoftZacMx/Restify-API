import { inject, injectable } from 'tsyringe';
import { IExpenseRepository } from '../../../domain/interfaces/expense-repository.interface';
import { AppError } from '../../../../shared/errors';
import { PrismaService } from '../../../infrastructure/config/prisma.config';
import { StockService } from '../../services/stock.service';

export interface DeleteExpenseInput {
  expense_id: string;
  /** Usuario que ejecuta el borrado — autoría de los movements compensatorios. */
  userId: string;
}

@injectable()
export class DeleteExpenseUseCase {
  constructor(
    @inject('IExpenseRepository') private readonly expenseRepository: IExpenseRepository,
    @inject(PrismaService) private readonly prismaService: PrismaService,
    @inject(StockService) private readonly stockService: StockService
  ) {}

  async execute(input: DeleteExpenseInput): Promise<void> {
    const expense = await this.expenseRepository.findById(input.expense_id);
    if (!expense) {
      throw new AppError('EXPENSE_NOT_FOUND');
    }

    // Para expenses no-MERCHANDISE este findItemsByExpenseId devuelve [], el bucle es no-op
    // y el flujo se reduce al delete directo (mismo comportamiento que antes).
    const items = await this.expenseRepository.findItemsByExpenseId(input.expense_id);

    const prisma = this.prismaService.getClient();
    await prisma.$transaction(async (tx) => {
      // Compensar cada compra con un ADJUSTMENT antes del delete (mientras los expense_items
      // todavía existen y la FK del movement compensatorio es válida). El cascade del delete
      // setea expenseItemId a null en ambos movements (original PURCHASE y este ADJUSTMENT),
      // preservando el ledger.
      for (const item of items) {
        await this.stockService.recordPurchaseReversal(
          {
            expenseItemId: item.id,
            reason: 'expense deleted',
            userId: input.userId,
          },
          tx
        );
      }

      await this.expenseRepository.delete(input.expense_id, tx);
    });
  }
}
