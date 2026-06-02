import { inject, injectable } from 'tsyringe';
import { StockService, WasteReason } from '../../services/stock.service';
import { RecordWasteInput } from '../../dto/stock.dto';

export interface RecordWasteCommand extends RecordWasteInput {
  userId: string;
}

@injectable()
export class RecordWasteUseCase {
  constructor(@inject(StockService) private readonly stockService: StockService) {}

  async execute(input: RecordWasteCommand) {
    const movement = await this.stockService.recordWaste({
      productId: input.productId,
      quantity: input.quantity,
      reason: input.reason as WasteReason,
      userId: input.userId,
      notes: input.notes ?? null,
    });

    if (!movement) {
      // trackStock=false → no se generó movement
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
