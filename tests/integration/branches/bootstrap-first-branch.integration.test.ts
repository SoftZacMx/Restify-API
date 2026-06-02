import { getBasePrisma } from '../../../src/core/infrastructure/database/prisma/get-prisma';
import { CreateFirstBranchUseCase } from '../../../src/core/application/use-cases/branches/create-first-branch.use-case';
import { BootstrapBranchService } from '../../../src/core/application/services/bootstrap-branch.service';

/**
 * Integration test demonstrating how CreateFirstBranchUseCase and BootstrapBranchService
 * work together during signup flow.
 *
 * This simulates what will happen in Etapa 4.1 (Signup público):
 * 1. Create organization (mocked here)
 * 2. Create user/owner (mocked here)
 * 3. Create first branch (CreateFirstBranchUseCase)
 * 4. Bootstrap branch with defaults (BootstrapBranchService)
 * 5. Return JWT with branch (mocked here)
 *
 * Note: Uses getBasePrisma() instead of getPrisma() because signup happens
 * outside of tenant context (withoutTenant). The tenant extension would
 * throw errors trying to inject organizationId/branchId.
 */
describe('Bootstrap First Branch Integration', () => {
  const prisma = getBasePrisma();
  const createFirstBranchUseCase = new CreateFirstBranchUseCase();
  const bootstrapBranchService = new BootstrapBranchService();

  let testOrgId: string;
  let testUserId: string;
  let testBranchId: string;

  beforeAll(async () => {
    // Setup: Create test organization and user
    // In real signup (Etapa 4.1), this will be part of the same transaction
    const org = await prisma.organization.create({
      data: {
        name: 'Test Restaurant',
        plan: 'FREE',
        status: 'ACTIVE',
      },
    });
    testOrgId = org.id;

    const user = await prisma.user.create({
      data: {
        name: 'Owner',
        last_name: 'Test',
        second_last_name: null,
        email: `test-${Date.now()}@example.com`,
        password: 'hashed-password',
        rol: 'OWNER',
        organizationId: testOrgId,
        accountStatus: 'ACTIVE',
        tokenVersion: 0,
      },
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    // Cleanup
    if (testBranchId) {
      await prisma.branch.delete({ where: { id: testBranchId } }).catch(() => {});
    }
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
    }
    if (testOrgId) {
      await prisma.organization.delete({ where: { id: testOrgId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  it('should create first branch and bootstrap it with defaults in a transaction', async () => {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create first branch
      const branch = await createFirstBranchUseCase.execute(tx, {
        organizationId: testOrgId,
        name: 'Sucursal Principal',
        state: 'CDMX',
        city: 'Ciudad de México',
        street: 'Reforma',
        exteriorNumber: '123',
        phone: '5512345678',
        rfc: 'TEST123456789',
        timezone: 'America/Mexico_City',
      });

      testBranchId = branch.id;

      // 2. Bootstrap with default data
      await bootstrapBranchService.execute(tx, branch.id, testUserId);

      return branch;
    });

    // Verify branch was created
    expect(result.id).toBeDefined();
    expect(result.name).toBe('Sucursal Principal');
    expect(result.organizationId).toBe(testOrgId);
    expect(result.isActive()).toBe(true);

    // Verify categories were created
    const categories = await prisma.menuCategory.findMany({
      where: { branchId: testBranchId },
      orderBy: { name: 'asc' },
    });

    expect(categories).toHaveLength(4);
    expect(categories.map((c) => c.name)).toEqual([
      'Bebidas',
      'Entradas',
      'Platos principales',
      'Postres',
    ]);
    expect(categories.every((c) => c.status === true)).toBe(true);

    // Verify initial table was created
    const tables = await prisma.table.findMany({
      where: { branchId: testBranchId },
    });

    expect(tables).toHaveLength(1);
    expect(tables[0].name).toBe('Mesa 1');
    expect(tables[0].userId).toBe(testUserId);
    expect(tables[0].status).toBe(true);
    expect(tables[0].availabilityStatus).toBe(true);
  });

  it('should rollback if bootstrap fails', async () => {
    const invalidBranchInput = {
      organizationId: testOrgId,
      name: 'Should Rollback',
      state: 'CDMX',
      city: 'Ciudad de México',
      street: 'Test',
      exteriorNumber: '1',
      phone: '555',
      timezone: 'America/Mexico_City',
    };

    let createdBranchId: string | undefined;

    await expect(
      prisma.$transaction(async (tx) => {
        const branch = await createFirstBranchUseCase.execute(tx, invalidBranchInput);
        createdBranchId = branch.id;

        // Simulate error during bootstrap
        throw new Error('Bootstrap failed');
      })
    ).rejects.toThrow('Bootstrap failed');

    // Verify branch was NOT created (transaction rolled back)
    if (createdBranchId) {
      const branch = await prisma.branch.findUnique({
        where: { id: createdBranchId },
      });
      expect(branch).toBeNull();
    }
  });
});
