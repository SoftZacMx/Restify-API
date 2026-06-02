import { inject, injectable } from 'tsyringe';
import { StockService } from '../../services/stock.service';
import { ListStockQuery } from '../../dto/stock.dto';

@injectable()
export class ListStockUseCase {
  constructor(@inject(StockService) private readonly stockService: StockService) {}

  async execute(input: ListStockQuery = {}) {
    const summary = await this.stockService.getStockSummary({
      search: input.search,
      lowStockOnly: input.lowStock,
    });

    return summary.map((s) => ({
      productId: s.productId,
      name: s.name,
      description: s.description,
      unitOfMeasure: s.unitOfMeasure,
      stockActual: s.stockActual.toString(),
      averageCost: s.averageCost.toString(),
      minStockAlert: s.minStockAlert?.toString() ?? null,
      trackStock: s.trackStock,
      isLowStock: s.isLowStock,
    }));
  }
}
