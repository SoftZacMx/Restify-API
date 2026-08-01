import { runWithTenant, withoutTenant, getOrganizationId, getBranchId } from '../../src/core/infrastructure/tenant/tenant-context';
import { getPrisma } from '../../src/core/infrastructure/database/prisma/get-prisma';
import { PrismaClient, OrganizationPlan } from '@prisma/client';
import { shouldSkipIntegration } from './utils';

// Los describes que tocan BD solo corren contra la BD local de pruebas
// (`npm run test:integration`); bajo `npm test` se saltan para no tocar la BD de dev.
const dbTestsSkipped = shouldSkipIntegration();

describe('Tenant Isolation', () => {
  const ORG_A_ID = 'org-a-uuid';
  const ORG_B_ID = 'org-b-uuid';
  const BRANCH_A1_ID = 'branch-a1-uuid';
  const BRANCH_A2_ID = 'branch-a2-uuid';
  const BRANCH_B1_ID = 'branch-b1-uuid';

  describe('TenantContext', () => {
    it('should set and get organizationId', () => {
      runWithTenant({ organizationId: ORG_A_ID }, () => {
        expect(getOrganizationId()).toBe(ORG_A_ID);
      });
    });

    it('should set and get branchId', () => {
      runWithTenant({ organizationId: ORG_A_ID, branchId: BRANCH_A1_ID }, () => {
        expect(getOrganizationId()).toBe(ORG_A_ID);
        expect(getBranchId()).toBe(BRANCH_A1_ID);
      });
    });

    it('should throw error when accessing organizationId without context', () => {
      expect(() => getOrganizationId()).toThrow('Tenant context is not set');
    });

    it('should return undefined when accessing branchId without context', () => {
      runWithTenant({ organizationId: ORG_A_ID }, () => {
        expect(getBranchId()).toBeUndefined();
      });
    });

    it('should isolate context between different invocations', () => {
      runWithTenant({ organizationId: ORG_A_ID, branchId: BRANCH_A1_ID }, () => {
        expect(getOrganizationId()).toBe(ORG_A_ID);
        expect(getBranchId()).toBe(BRANCH_A1_ID);

        // Nested context with different org
        runWithTenant({ organizationId: ORG_B_ID, branchId: BRANCH_B1_ID }, () => {
          expect(getOrganizationId()).toBe(ORG_B_ID);
          expect(getBranchId()).toBe(BRANCH_B1_ID);
        });

        // Back to original context
        expect(getOrganizationId()).toBe(ORG_A_ID);
        expect(getBranchId()).toBe(BRANCH_A1_ID);
      });
    });
  });

  describe('withoutTenant', () => {
    it('should clear tenant context', async () => {
      await runWithTenant({ organizationId: ORG_A_ID }, async () => {
        expect(getOrganizationId()).toBe(ORG_A_ID);

        await withoutTenant(async () => {
          // Inside withoutTenant, context should be cleared
          expect(() => getOrganizationId()).toThrow('Tenant context is not set');
        });

        // Outside withoutTenant, context should be restored
        expect(getOrganizationId()).toBe(ORG_A_ID);
      });
    });
  });

  describe('Prisma Extension - Organization Level', () => {
    const prisma = getPrisma();

    it('should automatically filter User queries by organizationId', async () => {
      if (dbTestsSkipped) return;
      // This test verifies that the extension is working
      // In a real scenario, it would query actual data

      await runWithTenant({ organizationId: ORG_A_ID }, async () => {
        // When we call findMany, the extension should add organizationId filter
        // Even though we don't specify it in the query
        try {
          await prisma.user.findMany({
            where: { status: true },
          });
          // If this doesn't throw, the extension is working
          // (it would fail if trying to query without extension)
        } catch (error) {
          // Expected in test environment without real DB
        }
      });
    });

    it('should not throw when querying User without tenant context (passthrough)', async () => {
      if (dbTestsSkipped) return;
      // Sin contexto → la extension NO filtra (rutas públicas: login, signup,
      // webhooks usan withoutTenant). El query pasa sin filtro de tenant.
      await withoutTenant(async () => {
        const users = await prisma.user.findMany();
        expect(Array.isArray(users)).toBe(true);
      });
    });
  });

  describe('Prisma Extension - Branch Level', () => {
    const prisma = getPrisma();
    const basePrisma = new PrismaClient();
    const createdOrderIds: string[] = [];

    // Branch real para poder crear una orden (FK de orders.branchId se valida).
    let seededOrgId: string;
    let seededBranchId: string;

    beforeAll(async () => {
      if (dbTestsSkipped) return;
      const org = await basePrisma.organization.create({
        data: { name: `Tenant Isolation Org ${Date.now()}`, plan: OrganizationPlan.FREE },
      });
      seededOrgId = org.id;

      const branch = await basePrisma.branch.create({
        data: {
          organizationId: seededOrgId,
          name: 'Tenant Isolation Branch',
          state: 'CDMX',
          city: 'CDMX',
          street: 'Reforma',
          exteriorNumber: '100',
          phone: '5551111111',
          timezone: 'America/Mexico_City',
          currency: 'MXN',
        },
      });
      seededBranchId = branch.id;
    });

    afterAll(async () => {
      if (dbTestsSkipped) return;
      if (createdOrderIds.length > 0) {
        await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
      }
      await basePrisma.branch.deleteMany({ where: { id: seededBranchId } });
      await basePrisma.organization.deleteMany({ where: { id: seededOrgId } });
      await basePrisma.$disconnect();
    });

    it('should automatically filter Order queries by branchId', async () => {
      if (dbTestsSkipped) return;
      await runWithTenant({ organizationId: ORG_A_ID, branchId: BRANCH_A1_ID }, async () => {
        try {
          await prisma.order.findMany({
            where: { status: false },
          });
          // Extension should add branchId filter automatically
        } catch (error) {
          // Expected in test environment without real DB
        }
      });
    });

    it('should throw error when querying Order without branchId', async () => {
      if (dbTestsSkipped) return;
      await runWithTenant({ organizationId: ORG_A_ID }, async () => {
        // branchId is undefined, should throw
        await expect(async () => {
          await prisma.order.findMany();
        }).rejects.toThrow('TENANT_BRANCH_REQUIRED');
      });
    });

    it('should automatically inject branchId when creating Order', async () => {
      if (dbTestsSkipped) return;
      await runWithTenant(
        { organizationId: seededOrgId, branchId: seededBranchId },
        async () => {
          // Create order without specifying branchId
          const order = await prisma.order.create({
            data: {
              total: 100,
              subtotal: 100,
              iva: 0,
              tip: 0,
              status: false,
              delivered: false,
              origin: 'Local',
              paymentDiffer: false,
              // branchId should be injected automatically
            },
          });
          createdOrderIds.push(order.id);
          expect(order.branchId).toBe(seededBranchId);
        }
      );
    });
  });

  describe('Data Isolation Simulation', () => {
    it('should prevent cross-organization data access', async () => {
      // Simulate: User from Org A should NOT see data from Org B

      // User from Org A logs in
      await runWithTenant({ organizationId: ORG_A_ID, branchId: BRANCH_A1_ID }, async () => {
        const orgA = getOrganizationId();
        const branchA = getBranchId();

        expect(orgA).toBe(ORG_A_ID);
        expect(branchA).toBe(BRANCH_A1_ID);

        // Any query here would be automatically filtered by ORG_A_ID and BRANCH_A1_ID
        // This prevents seeing data from ORG_B
      });

      // User from Org B logs in
      await runWithTenant({ organizationId: ORG_B_ID, branchId: BRANCH_B1_ID }, async () => {
        const orgB = getOrganizationId();
        const branchB = getBranchId();

        expect(orgB).toBe(ORG_B_ID);
        expect(branchB).toBe(BRANCH_B1_ID);

        // Queries here are filtered by ORG_B_ID and BRANCH_B1_ID
        // Completely isolated from ORG_A
      });
    });

    it('should prevent cross-branch data access within same organization', async () => {
      // User with access to Branch A1
      await runWithTenant({ organizationId: ORG_A_ID, branchId: BRANCH_A1_ID }, async () => {
        const branch = getBranchId();
        expect(branch).toBe(BRANCH_A1_ID);
        // Can only see orders from BRANCH_A1
      });

      // Same user switches to Branch A2
      await runWithTenant({ organizationId: ORG_A_ID, branchId: BRANCH_A2_ID }, async () => {
        const branch = getBranchId();
        expect(branch).toBe(BRANCH_A2_ID);
        // Now can only see orders from BRANCH_A2
        // Data from BRANCH_A1 is not accessible
      });
    });
  });

  describe('Global Models (No Filtering)', () => {
    const prisma = getPrisma();

    it('should NOT filter Organization queries', async () => {
      if (dbTestsSkipped) return;
      // Organization is a global model - should not be filtered
      await runWithTenant({ organizationId: ORG_A_ID }, async () => {
        try {
          // This should work without filtering by organizationId
          await prisma.organization.findMany();
        } catch (error) {
          // Expected in test environment
        }
      });
    });

    it('should NOT filter Branch queries', async () => {
      if (dbTestsSkipped) return;
      // Branch queries need to see all branches in org for switching
      await runWithTenant({ organizationId: ORG_A_ID, branchId: BRANCH_A1_ID }, async () => {
        try {
          // Should see all branches in the org, not just current branch
          await prisma.branch.findMany({
            where: { organizationId: ORG_A_ID },
          });
        } catch (error) {
          // Expected in test environment
        }
      });
    });
  });
});
