import { PrismaClient, OrganizationPlan, StockMovementType, UnitOfMeasure } from '@prisma/client';
import { getPrisma } from '../../src/core/infrastructure/database/prisma/get-prisma';
import { runWithTenant } from '../../src/core/infrastructure/tenant/tenant-context';

/**
 * Etapa 3.5 — Tests de aislamiento de stock y recetas (merge de qa)
 *
 * Verifica que las tablas que llegaron del merge de stock/recetas quedan aisladas
 * por sucursal igual que el resto del POS:
 * 1. StockMovement de branch A no es visible desde branch B
 * 2. MenuItemIngredient (recetas) de branch A no es visible desde branch B
 * 3. Create inyecta branchId del contexto automáticamente
 * 4. Query sin branchId en contexto lanza TENANT_BRANCH_REQUIRED
 */

function ensureTestEnv(): void {
  process.env.NODE_ENV = process.env.NODE_ENV || 'test';
  process.env.DATABASE_URL =
    process.env.DATABASE_URL || 'mysql://root:root_password@localhost:3306/restify';
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    process.env.JWT_SECRET = 'integration_test_jwt_secret_min_32_chars_ok';
  }
  process.env.PAYMENT_CONFIG_ENCRYPTION_KEY =
    process.env.PAYMENT_CONFIG_ENCRYPTION_KEY || 'a'.repeat(64);
}

function shouldSkipIntegration(): boolean {
  ensureTestEnv();
  return !process.env.DATABASE_URL || process.env.DATABASE_URL.includes('test');
}

describe('Etapa 3.5 — Stock & Recipe Isolation (Integration)', () => {
  const basePrisma = new PrismaClient();
  const prisma = getPrisma();
  let skipped = true;

  // Org A con dos sucursales, Org B con una
  let orgAId: string;
  let branchA1Id: string;
  let branchA2Id: string;
  let userAId: string;

  let orgBId: string;
  let branchB1Id: string;
  let userBId: string;

  // Datos sembrados (cleanup en cascada al borrar orgs)
  let productA1Id: string;
  let productB1Id: string;
  let menuItemA1Id: string;
  let menuItemB1Id: string;

  beforeAll(async () => {
    skipped = shouldSkipIntegration();
    if (skipped) return;
    ensureTestEnv();

    const orgA = await basePrisma.organization.create({
      data: { name: `Stock Iso Org A ${Date.now()}`, plan: OrganizationPlan.FREE },
    });
    orgAId = orgA.id;
    const orgB = await basePrisma.organization.create({
      data: { name: `Stock Iso Org B ${Date.now()}`, plan: OrganizationPlan.FREE },
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

    branchA1Id = (await mkBranch(orgAId, 'Centro A', '5551111111')).id;
    branchA2Id = (await mkBranch(orgAId, 'Norte A', '5552222222')).id;
    branchB1Id = (await mkBranch(orgBId, 'Centro B', '5553333333')).id;

    const userA = await basePrisma.user.create({
      data: {
        email: `stock-iso-a-${Date.now()}@test.local`,
        password: 'hashed_password',
        name: 'User',
        last_name: 'A',
        organizationId: orgAId,
        rol: 'OWNER',
        status: true,
      },
    });
    userAId = userA.id;
    const userB = await basePrisma.user.create({
      data: {
        email: `stock-iso-b-${Date.now()}@test.local`,
        password: 'hashed_password',
        name: 'User',
        last_name: 'B',
        organizationId: orgBId,
        rol: 'OWNER',
        status: true,
      },
    });
    userBId = userB.id;

    // Productos (tracked) por sucursal
    const productA1 = await basePrisma.product.create({
      data: {
        name: 'Harina A1',
        userId: userAId,
        branchId: branchA1Id,
        trackStock: true,
        unitOfMeasure: UnitOfMeasure.KG,
        stockActual: 10,
      },
    });
    productA1Id = productA1.id;

    const productB1 = await basePrisma.product.create({
      data: {
        name: 'Harina B1',
        userId: userBId,
        branchId: branchB1Id,
        trackStock: true,
        unitOfMeasure: UnitOfMeasure.KG,
        stockActual: 10,
      },
    });
    productB1Id = productB1.id;

    // Menu items por sucursal
    const menuItemA1 = await basePrisma.menuItem.create({
      data: { name: 'Pan A1', price: 20, userId: userAId, branchId: branchA1Id, status: true },
    });
    menuItemA1Id = menuItemA1.id;

    const menuItemB1 = await basePrisma.menuItem.create({
      data: { name: 'Pan B1', price: 20, userId: userBId, branchId: branchB1Id, status: true },
    });
    menuItemB1Id = menuItemB1.id;

    // Recetas (MenuItemIngredient) con branchId del padre
    await basePrisma.menuItemIngredient.create({
      data: { menuItemId: menuItemA1Id, productId: productA1Id, quantity: 1, branchId: branchA1Id },
    });
    await basePrisma.menuItemIngredient.create({
      data: { menuItemId: menuItemB1Id, productId: productB1Id, quantity: 1, branchId: branchB1Id },
    });

    // Movimientos de stock (StockMovement) con branchId del padre
    await basePrisma.stockMovement.create({
      data: {
        productId: productA1Id,
        quantity: 5,
        type: StockMovementType.PURCHASE,
        userId: userAId,
        branchId: branchA1Id,
      },
    });
    await basePrisma.stockMovement.create({
      data: {
        productId: productB1Id,
        quantity: 7,
        type: StockMovementType.PURCHASE,
        userId: userBId,
        branchId: branchB1Id,
      },
    });
  });

  afterAll(async () => {
    if (skipped) return;
    // Borrar orgs → cascada elimina branches, products, menu items, recetas y movimientos.
    await basePrisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });
    await basePrisma.$disconnect();
  });

  describe('1. StockMovement aislado por sucursal', () => {
    it('Branch A1 no ve movimientos de Branch B1', async () => {
      if (skipped) return;
      await runWithTenant({ organizationId: orgAId, branchId: branchA1Id }, async () => {
        const movements = await prisma.stockMovement.findMany();
        expect(movements.length).toBe(1);
        expect(movements.every((m: any) => m.branchId === branchA1Id)).toBe(true);
      });
    });

    it('Branch B1 solo ve sus propios movimientos', async () => {
      if (skipped) return;
      await runWithTenant({ organizationId: orgBId, branchId: branchB1Id }, async () => {
        const movements = await prisma.stockMovement.findMany();
        expect(movements.length).toBe(1);
        expect(Number(movements[0].quantity)).toBe(7);
      });
    });

    it('Branch A1 no ve movimientos de Branch A2 (misma org)', async () => {
      if (skipped) return;
      await runWithTenant({ organizationId: orgAId, branchId: branchA2Id }, async () => {
        const movements = await prisma.stockMovement.findMany();
        expect(movements.length).toBe(0);
      });
    });
  });

  describe('2. MenuItemIngredient (recetas) aislado por sucursal', () => {
    it('Branch A1 no ve recetas de Branch B1', async () => {
      if (skipped) return;
      await runWithTenant({ organizationId: orgAId, branchId: branchA1Id }, async () => {
        const ingredients = await prisma.menuItemIngredient.findMany();
        expect(ingredients.length).toBe(1);
        expect(ingredients[0].branchId).toBe(branchA1Id);
      });
    });

    it('Branch B1 solo ve sus propias recetas', async () => {
      if (skipped) return;
      await runWithTenant({ organizationId: orgBId, branchId: branchB1Id }, async () => {
        const ingredients = await prisma.menuItemIngredient.findMany();
        expect(ingredients.length).toBe(1);
        expect(ingredients[0].productId).toBe(productB1Id);
      });
    });
  });

  describe('3. Auto-inject branchId en create', () => {
    it('Al crear un StockMovement, se inyecta branchId del contexto', async () => {
      if (skipped) return;
      await runWithTenant({ organizationId: orgAId, branchId: branchA1Id }, async () => {
        const movement = await prisma.stockMovement.create({
          data: {
            productId: productA1Id,
            quantity: -1,
            type: StockMovementType.SALE,
            userId: userAId,
            // branchId no especificado → debe inyectarse
          },
        });
        expect(movement.branchId).toBe(branchA1Id);
      });
    });
  });

  describe('4. Error sin contexto de branch', () => {
    it('Query a StockMovement sin branchId lanza TENANT_BRANCH_REQUIRED', async () => {
      if (skipped) return;
      await runWithTenant({ organizationId: orgAId }, async () => {
        await expect(async () => {
          await prisma.stockMovement.findMany();
        }).rejects.toThrow('TENANT_BRANCH_REQUIRED');
      });
    });

    it('Query a MenuItemIngredient sin branchId lanza TENANT_BRANCH_REQUIRED', async () => {
      if (skipped) return;
      await runWithTenant({ organizationId: orgAId }, async () => {
        await expect(async () => {
          await prisma.menuItemIngredient.findMany();
        }).rejects.toThrow('TENANT_BRANCH_REQUIRED');
      });
    });
  });
});
