import {
  runWithTenant,
  withoutTenant,
  getTenant,
  getOrganizationId,
  getBranchId,
} from '../../../src/core/infrastructure/tenant/tenant-context';

describe('tenant-context (AsyncLocalStorage)', () => {
  it('getTenant devuelve undefined fuera de un contexto', () => {
    expect(getTenant()).toBeUndefined();
  });

  it('getTenant devuelve el store dentro de runWithTenant', () => {
    const store = { organizationId: 'org-1', branchId: 'branch-1' };

    const seen = runWithTenant(store, () => getTenant());

    expect(seen).toEqual(store);
  });

  it('getOrganizationId devuelve el organizationId', () => {
    expect(
      runWithTenant({ organizationId: 'org-1' }, () => getOrganizationId())
    ).toBe('org-1');
  });

  it('getOrganizationId lanza error si no hay contexto', () => {
    expect(() => getOrganizationId()).toThrow('Tenant context is not set');
  });

  it('getBranchId devuelve el branchId si existe', () => {
    expect(
      runWithTenant({ organizationId: 'org-1', branchId: 'branch-1' }, () => getBranchId())
    ).toBe('branch-1');
  });

  it('getBranchId devuelve undefined si el store no tiene branch', () => {
    expect(
      runWithTenant({ organizationId: 'org-1' }, () => getBranchId())
    ).toBeUndefined();
  });

  it('sinTenant limpia el contexto aunque se corra dentro de runWithTenant', async () => {
    const inside = await runWithTenant(
      { organizationId: 'org-1' },
      () => withoutTenant(async () => getTenant())
    );

    expect(inside).toBeUndefined();
  });

  it('sinTenant permite operar y luego restaura el contexto anterior', async () => {
    const after = await runWithTenant(
      { organizationId: 'org-1' },
      async () => {
        await withoutTenant(async () => {
          expect(getTenant()).toBeUndefined();
        });
        return getOrganizationId();
      }
    );

    expect(after).toBe('org-1');
  });

  it('runWithTenant anidados: el contexto más interno gana', () => {
    const seen = runWithTenant({ organizationId: 'org-1' }, () =>
      runWithTenant({ organizationId: 'org-2' }, () => getOrganizationId())
    );

    expect(seen).toBe('org-2');
  });

  it('el contexto es específico por cadena de ejecución (no es global)', async () => {
    const results = await Promise.all([
      runWithTenant({ organizationId: 'org-1' }, async () => {
        await new Promise((r) => setTimeout(r, 10));
        return getOrganizationId();
      }),
      runWithTenant({ organizationId: 'org-2' }, async () => {
        await new Promise((r) => setTimeout(r, 5));
        return getOrganizationId();
      }),
    ]);

    expect(results).toEqual(['org-1', 'org-2']);
  });
});
