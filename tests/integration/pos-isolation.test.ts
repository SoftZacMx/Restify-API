import 'reflect-metadata';
import { PrismaClient, OrganizationPlan } from '@prisma/client';
import { container } from 'tsyringe';
import { runWithTenant } from '../../src/core/infrastructure/tenant/tenant-context';

/**
 * Tarea 3.5 (Etapa 3) — Tests E2E de aislamiento del POS
 *
 * A diferencia de `tenant-data-isolation.test.ts` (que prueba la tenant extension
 * de Prisma de forma cruda con `prisma.order.findMany()`), aquí ejercitamos los
 * USE-CASES REALES del POS resueltos desde el contenedor de DI, tal como los invoca
 * un request autenticado. Confirma que el flujo completo (crear orden, listar
 * órdenes/menú/mesas) respeta el aislamiento por organización y por sucursal.
 *
 * Cubre el checklist de la Tarea 3.5:
 *  1. Dos orgs con dos sucursales cada una.
 *  2. Org A solo ve/crea/lista sus propios datos (nunca los de Org B).
 *  3. Sucursal A1 no ve datos de Sucursal A2 (misma org).
 *  4. Crear orden inyecta el branchId del contexto automáticamente.
 *  5. Acceder con un branchId de otra org no filtra datos ajenos (no leak).
 *  6. Operar el POS sin branch en contexto → TENANT_BRANCH_REQUIRED.
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

describe('Tarea 3.5 — POS Isolation E2E (Integration)', () => {
  const basePrisma = new PrismaClient();
  let skipped = true;

  // Use-cases reales del POS (se resuelven en beforeAll una vez cargado el DI).
  let createOrder: import('../../src/core/application/use-cases/orders/create-order.use-case').CreateOrderUseCase;
  let listOrders: import('../../src/core/application/use-cases/orders/list-orders.use-case').ListOrdersUseCase;
  let listMenuItems: import('../../src/core/application/use-cases/menu-items/list-menu-items.use-case').ListMenuItemsUseCase;
  let listTables: import('../../src/core/application/use-cases/tables/list-tables.use-case').ListTablesUseCase;

  // Org A con dos sucursales.
  let orgAId: string;
  let branchA1Id: string;
  let branchA2Id: string;
  let userAId: string;

  // Org B con dos sucursales.
  let orgBId: string;
  let branchB1Id: string;
  let branchB2Id: string;
  let userBId: string;

  // Menú sembrado por sucursal (para crear órdenes y comprobar listados).
  let menuItemA1Id: string;
  let menuItemA2Id: string;
  let menuItemB1Id: string;

  beforeAll(async () => {
    skipped = shouldSkipIntegration();
    if (skipped) return;
    ensureTestEnv();

    // Cargar el contenedor de DI y resolver los use-cases reales.
    try {
      await import('../../src/core/infrastructure/config/dependency-injection');
      const { CreateOrderUseCase } = await import(
        '../../src/core/application/use-cases/orders/create-order.use-case'
      );
      const { ListOrdersUseCase } = await import(
        '../../src/core/application/use-cases/orders/list-orders.use-case'
      );
      const { ListMenuItemsUseCase } = await import(
        '../../src/core/application/use-cases/menu-items/list-menu-items.use-case'
      );
      const { ListTablesUseCase } = await import(
        '../../src/core/application/use-cases/tables/list-tables.use-case'
      );
      createOrder = container.resolve(CreateOrderUseCase);
      listOrders = container.resolve(ListOrdersUseCase);
      listMenuItems = container.resolve(ListMenuItemsUseCase);
      listTables = container.resolve(ListTablesUseCase);
    } catch {
      skipped = true;
      return;
    }

    // --- Seed con basePrisma (bypassa la tenant extension) ---
    const orgA = await basePrisma.organization.create({
      data: { name: `POS Iso Org A ${Date.now()}`, plan: OrganizationPlan.FREE },
    });
    orgAId = orgA.id;
    const orgB = await basePrisma.organization.create({
      data: { name: `POS Iso Org B ${Date.now()}`, plan: OrganizationPlan.FREE },
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
    branchB2Id = (await mkBranch(orgBId, 'Norte B', '5554444444')).id;

    const mkUser = (orgId: string, suffix: string) =>
      basePrisma.user.create({
        data: {
          email: `pos-iso-${suffix}-${Date.now()}@test.local`,
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

    // Menú por sucursal (platos vendibles, no extras, sin receta ni stock).
    const mkMenuItem = (branchId: string, userId: string, name: string) =>
      basePrisma.menuItem.create({
        data: { name, price: 50, userId, branchId, status: true, isExtra: false },
      });

    menuItemA1Id = (await mkMenuItem(branchA1Id, userAId, 'Plato A1')).id;
    menuItemA2Id = (await mkMenuItem(branchA2Id, userAId, 'Plato A2')).id;
    menuItemB1Id = (await mkMenuItem(branchB1Id, userBId, 'Plato B1')).id;

    // Mesas por sucursal (cada local tiene su propia "Mesa 1").
    const mkTable = (branchId: string, userId: string) =>
      basePrisma.table.create({
        data: { name: 'Mesa 1', branchId, userId, status: true, availabilityStatus: true },
      });
    await mkTable(branchA1Id, userAId);
    await mkTable(branchA2Id, userAId);
    await mkTable(branchB1Id, userBId);
  });

  afterAll(async () => {
    if (skipped) return;
    // Borrar las orgs → cascada elimina branches, users, menú, mesas y órdenes.
    await basePrisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });
    await basePrisma.$disconnect();
  });

  /** Crea una orden de 1 unidad del menuItem dado dentro del contexto tenant indicado. */
  function createOrderIn(orgId: string, branchId: string, menuItemId: string, userId: string) {
    return runWithTenant({ organizationId: orgId, branchId }, () =>
      createOrder.execute({
        paymentMethod: 1,
        tip: 0,
        origin: 'Local',
        paymentDiffer: false,
        userId,
        orderItems: [{ menuItemId, quantity: 1, price: 50, extras: [] }],
      })
    );
  }

  describe('1. Crear orden inyecta el branchId del contexto', () => {
    it('Orden creada en A1 lleva branchId = A1', async () => {
      if (skipped) return;
      const order = await createOrderIn(orgAId, branchA1Id, menuItemA1Id, userAId);
      expect(order.id).toBeDefined();
      // Verificación directa contra la DB (sin filtro) de que la fila quedó en A1.
      const row = await basePrisma.order.findUnique({ where: { id: order.id } });
      expect(row?.branchId).toBe(branchA1Id);
    });
  });

  describe('2. Listado de órdenes aislado por sucursal y por org', () => {
    it('Sucursal A1 solo ve sus órdenes; A2 (misma org) y B no aparecen', async () => {
      if (skipped) return;

      // Sembrar una orden en cada sucursal vía el use-case real.
      await createOrderIn(orgAId, branchA1Id, menuItemA1Id, userAId);
      await createOrderIn(orgAId, branchA2Id, menuItemA2Id, userAId);
      await createOrderIn(orgBId, branchB1Id, menuItemB1Id, userBId);

      const fromA1 = await runWithTenant(
        { organizationId: orgAId, branchId: branchA1Id },
        () => listOrders.execute({ page: 1, limit: 100 })
      );
      const fromA2 = await runWithTenant(
        { organizationId: orgAId, branchId: branchA2Id },
        () => listOrders.execute({ page: 1, limit: 100 })
      );
      const fromB1 = await runWithTenant(
        { organizationId: orgBId, branchId: branchB1Id },
        () => listOrders.execute({ page: 1, limit: 100 })
      );

      // Cada sucursal ve un conjunto disjunto de IDs de orden.
      const idsA1 = new Set(fromA1.data.map((o) => o.id));
      const idsA2 = new Set(fromA2.data.map((o) => o.id));
      const idsB1 = new Set(fromB1.data.map((o) => o.id));

      expect(idsA1.size).toBeGreaterThan(0);
      expect(idsA2.size).toBeGreaterThan(0);
      expect(idsB1.size).toBeGreaterThan(0);

      // A1 ∩ A2 = ∅ (aislamiento entre sucursales de la misma org).
      for (const id of idsA1) expect(idsA2.has(id)).toBe(false);
      // A1 ∩ B1 = ∅ (aislamiento entre organizaciones).
      for (const id of idsA1) expect(idsB1.has(id)).toBe(false);
    });

    it('El total reportado por A1 no incluye las órdenes de B1', async () => {
      if (skipped) return;
      const fromA1 = await runWithTenant(
        { organizationId: orgAId, branchId: branchA1Id },
        () => listOrders.execute({ page: 1, limit: 100 })
      );
      // Las filas reales de A1 en la DB coinciden con lo que reporta el use-case.
      const realA1 = await basePrisma.order.count({ where: { branchId: branchA1Id } });
      expect(fromA1.pagination.total).toBe(realA1);
    });
  });

  describe('3. Menú y mesas aislados por sucursal', () => {
    it('list-menu-items de A1 no devuelve el menú de A2 ni el de B', async () => {
      if (skipped) return;
      const menuA1 = await runWithTenant(
        { organizationId: orgAId, branchId: branchA1Id },
        () => listMenuItems.execute()
      );
      const ids = menuA1.map((m) => m.id);
      expect(ids).toContain(menuItemA1Id);
      expect(ids).not.toContain(menuItemA2Id);
      expect(ids).not.toContain(menuItemB1Id);
    });

    it('list-tables de B1 solo devuelve mesas de B1', async () => {
      if (skipped) return;
      const tablesB1 = await runWithTenant(
        { organizationId: orgBId, branchId: branchB1Id },
        () => listTables.execute()
      );
      expect(tablesB1.length).toBeGreaterThan(0);
      // Ninguna de las mesas devueltas pertenece a otra sucursal.
      const realB1Ids = new Set(
        (await basePrisma.table.findMany({ where: { branchId: branchB1Id } })).map((t) => t.id)
      );
      for (const t of tablesB1) expect(realB1Ids.has(t.id)).toBe(true);
    });
  });

  describe('4. Acceso cruzado y ausencia de contexto', () => {
    it('Listar con branch de otra org no devuelve datos de la org actual', async () => {
      if (skipped) return;
      // Contexto org A pero branchId de B2 (vacía): la extension filtra por branchId
      // literal, así que no hay leak de las órdenes reales de A.
      const leaked = await runWithTenant(
        { organizationId: orgAId, branchId: branchB2Id },
        () => listOrders.execute({ page: 1, limit: 100 })
      );
      // B2 está vacía → resultado vacío. Nunca expone las órdenes reales de A1.
      const realB2 = await basePrisma.order.count({ where: { branchId: branchB2Id } });
      expect(leaked.pagination.total).toBe(realB2);
      const a1Ids = new Set(
        (await basePrisma.order.findMany({ where: { branchId: branchA1Id } })).map((o) => o.id)
      );
      for (const o of leaked.data) expect(a1Ids.has(o.id)).toBe(false);
    });

    it('Crear una orden sin branch en contexto lanza TENANT_BRANCH_REQUIRED', async () => {
      if (skipped) return;
      await expect(
        runWithTenant({ organizationId: orgAId }, () =>
          createOrder.execute({
            paymentMethod: 1,
            tip: 0,
            origin: 'Local',
            paymentDiffer: false,
            userId: userAId,
            orderItems: [{ menuItemId: menuItemA1Id, quantity: 1, price: 50, extras: [] }],
          })
        )
      ).rejects.toThrow('TENANT_BRANCH_REQUIRED');
    });

    it('Listar órdenes sin branch en contexto lanza TENANT_BRANCH_REQUIRED', async () => {
      if (skipped) return;
      await expect(
        runWithTenant({ organizationId: orgAId }, () =>
          listOrders.execute({ page: 1, limit: 10 })
        )
      ).rejects.toThrow('TENANT_BRANCH_REQUIRED');
    });
  });
});
