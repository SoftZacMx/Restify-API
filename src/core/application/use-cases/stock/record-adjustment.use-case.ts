import { inject, injectable } from 'tsyringe';
import { StockService } from '../../services/stock.service';
import { RecordAdjustmentInput } from '../../dto/stock.dto';

export interface RecordAdjustmentCommand extends RecordAdjustmentInput {
  userId: string;
}

@injectable()
export class RecordAdjustmentUseCase {
  constructor(@inject(StockService) private readonly stockService: StockService) {}

  async execute(input: RecordAdjustmentCommand) {
    const movement = await this.stockService.recordAdjustment({
      productId: input.productId,
      newStock: input.newStock,
      reason: input.reason,
      userId: input.userId,
      notes: input.notes ?? null,
    });

    if (!movement) {
      // trackStock=false o diff=0 → no se generó movement
      return { recorded: false, movement: null };
    }

    return {
      recorded: true,
      movement: {
        id: movement.id,
        productId: movement.productId,
        quantity: movement.quantity.toString(),
        type: movement.type,
        reason: movement.reason,
        createdAt: movement.createdAt,
      },
    };
  }
}
