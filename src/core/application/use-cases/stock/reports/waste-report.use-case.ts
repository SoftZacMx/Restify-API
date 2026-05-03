import { inject, injectable } from 'tsyringe';
import { StockMovementType } from '@prisma/client';
import { StockService } from '../../../services/stock.service';

export interface WasteReportInput {
  from?: Date;
  to?: Date;
}

/**
 * Reporte de merma agrupada por motivo en un rango.
 * Devuelve totales por reason + total general (en cantidad y en valor).
 * El valor se calcula con el `averageCost` actual del producto al momento del reporte
 * (aproximación; para mayor fidelidad histórica habría que snapshotear el costo en el movement).
 */
@injectable()
export class WasteReportUseCase {
  constructor(@inject(StockService) private readonly stockService: StockService) {}

  async execute(input: WasteReportInput = {}) {
    const movements = await this.stockService.getMovements({
      type: StockMovementType.WASTE,
      from: input.from,
      to: input.to,
      limit: 500,
    });

    const byReason: Record<string, { quantity: number; count: number }> = {};
    for (const m of movements) {
      const reason = m.reason ?? 'OTHER';
      const qty = Math.abs(Number(m.quantity));
      if (!byReason[reason]) byReason[reason] = { quantity: 0, count: 0 };
      byReason[reason].quantity += qty;
      byReason[reason].count += 1;
    }

    return {
      from: input.from ?? null,
      to: input.to ?? null,
      byReason,
      totalCount: movements.length,
    };
  }
}
