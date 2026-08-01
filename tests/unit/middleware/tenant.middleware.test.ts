import { TenantMiddleware } from '../../../src/server/middleware/tenant.middleware';
import { getTenant } from '../../../src/core/infrastructure/tenant/tenant-context';

describe('TenantMiddleware', () => {
  let next: jest.Mock;

  beforeEach(() => {
    next = jest.fn();
  });

  it('rechaza un token sin organización (fail-secure)', () => {
    const req = { user: {} } as any;

    TenantMiddleware.attach(req, {} as any, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'ORGANIZATION_NOT_FOUND' }));
  });

  it('rechaza un token sin user', () => {
    TenantMiddleware.attach({} as any, {} as any, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'ORGANIZATION_NOT_FOUND' }));
  });

  it('establece el contexto de tenant con org y branch antes de continuar', () => {
    const req = { user: { org: 'org-1', branch: 'branch-1' } } as any;

    let seenTenant: unknown;
    next.mockImplementation(() => {
      seenTenant = getTenant();
    });

    TenantMiddleware.attach(req, {} as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(seenTenant).toEqual({ organizationId: 'org-1', branchId: 'branch-1' });
  });

  it('establece el contexto con org y sin branch', () => {
    const req = { user: { org: 'org-1' } } as any;

    let seenTenant: unknown;
    next.mockImplementation(() => {
      seenTenant = getTenant();
    });

    TenantMiddleware.attach(req, {} as any, next);

    expect(seenTenant).toEqual({ organizationId: 'org-1', branchId: undefined });
  });

  it('el contexto solo está activo durante el next (no queda colgado después)', () => {
    const req = { user: { org: 'org-1', branch: 'branch-1' } } as any;

    TenantMiddleware.attach(req, {} as any, jest.fn());

    expect(getTenant()).toBeUndefined();
  });
});
