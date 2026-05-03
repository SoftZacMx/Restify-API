import { inject, injectable } from 'tsyringe';
import { StockService } from '../../services/stock.service';
import { UpdateStockConfigInput } from '../../dto/stock.dto';

@injectable()
export class UpdateStockConfigUseCase {
  constructor(@inject(StockService) private readonly stockService: StockService) {}

  async execute(productId: string, input: UpdateStockConfigInput): Promise<{ updated: true }> {
    await this.stockService.updateStockConfig(productId, {
      trackStock: input.trackStock,
      unitOfMeasure: input.unitOfMeasure,
      minStockAlert: input.minStockAlert,
    });
    return { updated: true };
  }
}
