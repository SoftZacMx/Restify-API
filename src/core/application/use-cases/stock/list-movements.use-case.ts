import { inject, injectable } from 'tsyringe';
import { StockService } from '../../services/stock.service';
import { ListMovementsQuery } from '../../dto/stock.dto';

@injectable()
export class ListMovementsUseCase {
  constructor(@inject(StockService) private readonly stockService: StockService) {}

  async execute(input: ListMovementsQuery = {}) {
    const movements = await this.stockService.getMovements({
      productId: input.productId,
      type: input.type,
      reason: input.reason,
      from: input.from,
      to: input.to,
      limit: input.limit,
      offset: input.offset,
    });

    return movements.map((m) => ({
      id: m.id,
      productId: m.productId,
      quantity: m.quantity.toString(),
      type: m.type,
      reason: m.reason,
      notes: m.notes,
      expenseItemId: m.expenseItemId,
      orderItemId: m.orderItemId,
      userId: m.userId,
      createdAt: m.createdAt,
    }));
  }
}
