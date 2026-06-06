import { injectable } from 'tsyringe';
import { getPrisma } from '../../../../infrastructure/database/prisma/get-prisma';

/**
 * Reporte de costo teórico y margen por MenuItem con receta.
 *
 * - Costo teórico = Σ (ingrediente.quantity × producto.averageCost)
 * - Margen = price − costo
 * - Margen % = margen / price × 100
 *
 * MenuItems sin receta son omitidos (el costo no se puede calcular sin ingredientes).
 */
@injectable()
export class MenuItemsCostReportUseCase {
  // Cliente extendido (tenant-filtered): filtra MenuItem por branchId del contexto.
  private get prisma() {
    return getPrisma();
  }

  async execute() {
    const menuItems = await this.prisma.menuItem.findMany({
      where: { ingredients: { some: {} } },
      include: {
        ingredients: { include: { product: { select: { averageCost: true } } } },
      },
    });

    return menuItems.map((mi) => {
      const cost = mi.ingredients.reduce(
        (acc, ing) => acc + Number(ing.quantity) * Number(ing.product.averageCost),
        0
      );
      const price = Number(mi.price);
      const margin = price - cost;
      const marginPct = price > 0 ? Number(((margin / price) * 100).toFixed(2)) : 0;
      return {
        menuItemId: mi.id,
        name: mi.name,
        price,
        cost: Number(cost.toFixed(4)),
        margin: Number(margin.toFixed(4)),
        marginPct,
        lowMargin: marginPct < 30,
      };
    });
  }
}
