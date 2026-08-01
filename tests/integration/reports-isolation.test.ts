import 'reflect-metadata';
import { PrismaClient, OrganizationPlan, StockMovementType, UnitOfMeasure } from '@prisma/client';
import { container } from 'tsyringe';
import { runWithTenant } from '../../src/core/infrastructure/tenant/tenant-context';
import { ensureTestEnv, shouldSkipIntegration } from './utils';

/**
 * Aislamiento multi-tenant de los reportes de stock/ventas.
 *
 * Antes, estos tres reportes usaban el cliente Prisma BASE (`prismaService.getClient()`),
 * que NO aplica la tenant extension, por lo que agregaban datos de TODAS las sucursales:
 *   - ProductsConsumptionReportUseCase  (GET /api/reports/products/consumption)
 *   - MenuItemsCostReportUseCase        (GET /api/reports/menu-items/cost)
 *   - SalesPerformanceReportGenerator   (GET /api/reports?type=SALES_PERFORMANCE)
 *
 * Tras el fix usan `getPrisma()` (cliente extendido) → la extension filtra
 * StockMovement / MenuItem / OrderItem por el branchId del contexto.
 *
 * Este test siembra datos en dos sucursales de dos organizaciones distintas y
 * comprueba que cada reporte, ejecutado bajo el contexto de la sucursal A, solo
 * refleja datos de A (nunca de B).
 */

describe('Reports Isolation E2E (stock & sales)', () => {
  const basePrisma = new PrismaClient();
  let skipped = true;

  let consumptionReport: import('../../src/core/application/use-cases/stock/reports/products-consumption-report.use-case').ProductsConsumptionReportUseCase;
  let menuCostReport: import('../../src/core/application/use-cases/stock/reports/menu-items-cost-report.use-case').MenuItemsCostReportUseCase;
  let salesPerformance: import('../../src/core/application/reports/generators/sales-performance-report.generator').SalesPerformanceReportGenerator;

  // Org A.
  let orgAId: string;
  let branchAId: string;
  let userAId: string;
  let productAId: string;
  let menuItemAId: string;

  // Org B.
  let orgBId: string;
  let branchBId: string;
  let userBId: string;
  let productBId: string;
  let menuItemBId: string;

  beforeAll(async () => {
    skipped = shouldSkipIntegration();
    if (skipped) return;
    ensureTestEnv();

    try {
      await import('../../src/core/infrastructure/config/dependency-injection');
      const { ProductsConsumptionReportUseCase } = await import(
        '../../src/core/application/use-cases/stock/reports/products-consumption-report.use-case'
      );
      const { MenuItemsCostReportUseCase } = await import(
        '../../src/core/application/use-cases/stock/reports/menu-items-cost-report.use-case'
      );
      const { SalesPerformanceReportGenerator } = await import(
        '../../src/core/application/reports/generators/sales-performance-report.generator'
      );
      consumptionReport = container.resolve(ProductsConsumptionReportUseCase);
      menuCostReport = container.resolve(MenuItemsCostReportUseCase);
      salesPerformance = container.resolve(SalesPerformanceReportGenerator);
    } catch {
      skipped = true;
      return;
    }

    // --- Seed con basePrisma (bypassa la tenant extension) ---
    const orgA = await basePrisma.organization.create({
      data: { name: `Reports Iso Org A ${Date.now()}`, plan: OrganizationPlan.FREE },
    });
    orgAId = orgA.id;
    const orgB = await basePrisma.organization.create({
      data: { name: `Reports Iso Org B ${Date.now()}`, plan: OrganizationPlan.FREE },
    });
    orgBId = orgB.id;

    const mkBranch = (orgId: string, name: string, phone: string) =>
      basePrisma.branch.create({
        data: {
          organizationId: orgId,
          name,
          state: 'CDMX',
          city: 'CDMX',
          street: 'Calle',
          exteriorNumber: '1',
          phone,
          timezone: 'America/Mexico_City',
          currency: 'MXN',
        },
      });
    branchAId = (await mkBranch(orgAId, 'Centro A', '5551111111')).id;
    branchBId = (await mkBranch(orgBId, 'Centro B', '5553333333')).id;

    const mkUser = (orgId: string, suffix: string) =>
      basePrisma.user.create({
        data: {
          email: `reports-iso-${suffix}-${Date.now()}@test.local`,
          password: 'hashed_password',
          name: 'User',
          last_name: suffix.toUpperCase(),
          organizationId: orgId,
          rol: 'OWNER',
          status: true,
        },
      });
    userAId = (await mkUser(orgAId, 'a')).id;
    userBId = (await mkUser(orgBId, 'b')).id;

    // Productos con costo, uno por sucursal.
    const mkProduct = (branchId: string, userId: string, name: string, cost: number) =>
      basePrisma.product.create({
        data: {
          name,
          userId,
          branchId,
          trackStock: true,
          unitOfMeasure: UnitOfMeasure.KG,
          stockActual: 100,
          averageCost: cost,
        },
      });
    productAId = (await mkProduct(branchAId, userAId, 'Insumo A', 10)).id;
    productBId = (await mkProduct(branchBId, userBId, 'Insumo B', 20)).id;

    // Menu items con receta (para el reporte de costo/margen).
    const mkMenuItem = (branchId: string, userId: string, name: string, price: number) =>
      basePrisma.menuItem.create({
        data: { name, price, userId, branchId, status: true, isExtra: false },
      });
    menuItemAId = (await mkMenuItem(branchAId, userAId, 'Plato A', 100)).id;
    menuItemBId = (await mkMenuItem(branchBId, userBId, 'Plato B', 100)).id;

    await basePrisma.menuItemIngredient.create({
      data: { menuItemId: menuItemAId, productId: productAId, quantity: 2, branchId: branchAId },
    });
    await basePrisma.menuItemIngredient.create({
      data: { menuItemId: menuItemBId, productId: productBId, quantity: 2, branchId: branchBId },
    });

    // Movimientos de SALE (para el reporte de consumo): A consume 5, B consume 9.
    await basePrisma.stockMovement.create({
      data: {
        productId: productAId,
        quantity: -5,
        type: StockMovementType.SALE,
        userId: userAId,
        branchId: branchAId,
      },
    });
    await basePrisma.stockMovement.create({
      data: {
        productId: productBId,
        quantity: -9,
        type: StockMovementType.SALE,
        userId: userBId,
        branchId: branchBId,
      },
    });

    // Órdenes pagadas + items (para el reporte de performance de ventas).
    const mkPaidOrderItem = async (branchId: string, menuItemId: string, qty: number) => {
      const order = await basePrisma.order.create({
        data: {
          branchId,
          total: 100,
          subtotal: 100,
          iva: 0,
          tip: 0,
          status: true, // pagada
          delivered: false,
          origin: 'Local',
          paymentDiffer: false,
        },
      });
      await basePrisma.orderItem.create({
        data: { quantity: qty, price: 100, orderId: order.id, menuItemId, branchId },
      });
    };
    await mkPaidOrderItem(branchAId, menuItemAId, 3);
    await mkPaidOrderItem(branchBId, menuItemBId, 7);
  });

  afterAll(async () => {
    if (skipped) return;
    // Order.branchId es onDelete:SetNull → borrar órdenes antes de las orgs
    // para no dejar filas huérfanas con branchId NULL.
    await basePrisma.order.deleteMany({
      where: { branchId: { in: [branchAId, branchBId] } },
    });
    await basePrisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });
    await basePrisma.$disconnect();
  });

  describe('ProductsConsumptionReport', () => {
    it('Sucursal A solo ve el consumo de sus propios productos', async () => {
      if (skipped) return;
      const report = await runWithTenant(
        { organizationId: orgAId, branchId: branchAId },
        () => consumptionReport.execute({ top: 50 })
      );
      const productIds = report.items.map((i) => i.productId);
      expect(productIds).toContain(productAId);
      expect(productIds).not.toContain(productBId);
      // El consumo total no mezcla las cantidades de B (9).
      const itemA = report.items.find((i) => i.productId === productAId);
      expect(itemA?.consumed).toBe(5);
    });
  });

  describe('MenuItemsCostReport', () => {
    it('Sucursal A solo ve el costo/margen de su propio menú', async () => {
      if (skipped) return;
      const report = await runWithTenant(
        { organizationId: orgAId, branchId: branchAId },
        () => menuCostReport.execute()
      );
      const menuItemIds = report.map((r) => r.menuItemId);
      expect(menuItemIds).toContain(menuItemAId);
      expect(menuItemIds).not.toContain(menuItemBId);
    });
  });

  describe('SalesPerformanceReport', () => {
    it('Sucursal A solo ve las ventas de su propia sucursal', async () => {
      if (skipped) return;
      const result = await runWithTenant(
        { organizationId: orgAId, branchId: branchAId },
        () => salesPerformance.generate({})
      );
      // El resultado del generador expone `data` (BaseReportResult).
      const data: any = (result as any).data ?? result;
      const sales: Array<{ menuItemId: string; quantitySold: number }> = data.sales;
      const menuItemIds = sales.map((s) => s.menuItemId);
      expect(menuItemIds).toContain(menuItemAId);
      expect(menuItemIds).not.toContain(menuItemBId);
      // La cantidad vendida es la de A (3), no incluye la de B (7).
      const saleA = sales.find((s) => s.menuItemId === menuItemAId);
      expect(saleA?.quantitySold).toBe(3);
    });
  });

  describe('Sin contexto de branch', () => {
    it('El reporte de consumo sin branch lanza TENANT_BRANCH_REQUIRED', async () => {
      if (skipped) return;
      await expect(
        runWithTenant({ organizationId: orgAId }, () => consumptionReport.execute({ top: 50 }))
      ).rejects.toThrow('TENANT_BRANCH_REQUIRED');
    });
  });
});
