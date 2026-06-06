import { injectable } from 'tsyringe';
import { Prisma, StockMovementType } from '@prisma/client';
import { getPrisma } from '../../../../infrastructure/database/prisma/get-prisma';

export interface ProductsConsumptionReportInput {
  from?: Date;
  to?: Date;
  top?: number;
}

/**
 * Top N productos consumidos (cantidad descontada por SALE) en un rango.
 * Útil para saber qué hay que comprar más seguido.
 */
@injectable()
export class ProductsConsumptionReportUseCase {
  // Cliente extendido (tenant-filtered): filtra StockMovement/Product por branchId del contexto.
  private get prisma() {
    return getPrisma();
  }

  async execute(input: ProductsConsumptionReportInput = {}) {
    const top = input.top ?? 10;

    const where: Prisma.StockMovementWhereInput = {
      type: StockMovementType.SALE,
    };
    if (input.from || input.to) {
      where.createdAt = {};
      if (input.from) where.createdAt.gte = input.from;
      if (input.to) where.createdAt.lte = input.to;
    }

    const grouped = await this.prisma.stockMovement.groupBy({
      by: ['productId'],
      where,
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'asc' } }, // más negativo = más consumido
      take: top,
    });

    const productIds = grouped.map((g) => g.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, unitOfMeasure: true, averageCost: true },
    });
    const productById = new Map(products.map((p) => [p.id, p]));

    const totalConsumedQty = grouped.reduce(
      (acc, g) => acc + Math.abs(Number(g._sum.quantity ?? 0)),
      0
    );

    return {
      from: input.from ?? null,
      to: input.to ?? null,
      top,
      items: grouped.map((g) => {
        const consumed = Math.abs(Number(g._sum.quantity ?? 0));
        const product = productById.get(g.productId);
        const value = product ? consumed * Number(product.averageCost) : 0;
        const share = totalConsumedQty > 0 ? consumed / totalConsumedQty : 0;
        return {
          productId: g.productId,
          name: product?.name ?? null,
          unitOfMeasure: product?.unitOfMeasure ?? null,
          consumed,
          value,
          sharePct: Number((share * 100).toFixed(2)),
        };
      }),
    };
  }
}
