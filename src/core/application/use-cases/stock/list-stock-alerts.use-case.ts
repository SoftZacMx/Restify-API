import { inject, injectable } from 'tsyringe';
import { StockService } from '../../services/stock.service';

@injectable()
export class ListStockAlertsUseCase {
  constructor(@inject(StockService) private readonly stockService: StockService) {}

  async execute() {
    const summary = await this.stockService.getStockSummary({ lowStockOnly: true });

    return summary.map((s) => ({
      productId: s.productId,
      name: s.name,
      unitOfMeasure: s.unitOfMeasure,
      stockActual: s.stockActual.toString(),
      minStockAlert: s.minStockAlert?.toString() ?? null,
    }));
  }
}
