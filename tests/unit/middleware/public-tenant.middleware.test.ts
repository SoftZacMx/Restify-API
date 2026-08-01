jest.mock('tsyringe', () => ({
  container: {
    resolve: jest.fn(),
  },
  singleton: () => (target: any) => target,
  injectable: () => (target: any) => target,
  inject: () => () => undefined,
}));

import { PublicTenantMiddleware } from '../../../src/server/middleware/public-tenant.middleware';
import { TenantResolverService } from '../../../src/core/application/services/tenant-resolver.service';
import { getTenant } from '../../../src/core/infrastructure/tenant/tenant-context';

const tsyringe = require('tsyringe');
const mockResolve = tsyringe.container.resolve as jest.Mock;

describe('PublicTenantMiddleware', () => {
  let mockNext: jest.Mock;
  let resolveMock: jest.Mock;

  beforeEach(() => {
    mockResolve.mockReset();
    mockNext = jest.fn();
    resolveMock = jest.fn();
    mockResolve.mockReturnValue({ resolve: resolveMock });
  });

  it('toma el branchId del query y establece el contexto de tenant', async () => {
    resolveMock.mockResolvedValue({
      ok: true,
      tenant: { organizationId: 'org-1', branchId: 'branch-1' },
      branch: {},
    });
    const req = { query: { branchId: 'branch-1' }, body: {} } as any;

    await new Promise<void>((done) => {
      PublicTenantMiddleware.fromBranch(req, {} as any, (err?: unknown) => {
        expect(err).toBeUndefined();
        done();
      });
    });

    expect(mockResolve).toHaveBeenCalledWith(TenantResolverService);
    expect(resolveMock).toHaveBeenCalledWith('branch-1', { requireActiveBranch: true });
  });

  it('toma el branchId del body cuando no viene en el query', async () => {
    resolveMock.mockResolvedValue({
      ok: true,
      tenant: { organizationId: 'org-1', branchId: 'branch-1' },
      branch: {},
    });
    const req = { query: {}, body: { branchId: 'branch-9' } } as any;

    await new Promise<void>((done) => {
      PublicTenantMiddleware.fromBranch(req, {} as any, (err?: unknown) => {
        expect(err).toBeUndefined();
        done();
      });
    });

    expect(resolveMock).toHaveBeenCalledWith('branch-9', { requireActiveBranch: true });
  });

  it('rechaza con VALIDATION_ERROR si falta el branchId', async () => {
    const req = { query: {}, body: {} } as any;

    await new Promise<void>((done) => {
      PublicTenantMiddleware.fromBranch(req, {} as any, (err: any) => {
        expect(err).toMatchObject({ code: 'VALIDATION_ERROR' });
        done();
      });
    });

    expect(mockResolve).not.toHaveBeenCalled();
  });

  it('mapea ORGANIZATION_INACTIVE a AppError', async () => {
    resolveMock.mockResolvedValue({ ok: false, reason: 'ORGANIZATION_INACTIVE', organizationId: 'org-1' });
    const req = { query: { branchId: 'branch-1' }, body: {} } as any;

    await new Promise<void>((done) => {
      PublicTenantMiddleware.fromBranch(req, {} as any, (err: any) => {
        expect(err).toMatchObject({ code: 'ORGANIZATION_INACTIVE' });
        done();
      });
    });
  });

  it('mapea BRANCH_NOT_FOUND (branch inexistente o inactivo) a AppError', async () => {
    resolveMock.mockResolvedValue({ ok: false, reason: 'BRANCH_NOT_FOUND' });
    const req = { query: { branchId: 'branch-1' }, body: {} } as any;

    await new Promise<void>((done) => {
      PublicTenantMiddleware.fromBranch(req, {} as any, (err: any) => {
        expect(err).toMatchObject({ code: 'BRANCH_NOT_FOUND' });
        done();
      });
    });
  });

  it('establece el contexto de tenant mientras el request continúa', async () => {
    resolveMock.mockResolvedValue({
      ok: true,
      tenant: { organizationId: 'org-1', branchId: 'branch-1' },
      branch: {},
    });
    const req = { query: { branchId: 'branch-1' }, body: {} } as any;

    let seenTenant: unknown;
    await new Promise<void>((done) => {
      PublicTenantMiddleware.fromBranch(req, {} as any, () => {
        seenTenant = getTenant();
        done();
      });
    });

    expect(seenTenant).toEqual({ organizationId: 'org-1', branchId: 'branch-1' });
    expect(getTenant()).toBeUndefined();
  });

  it('propaga al next errores inesperados del resolver', async () => {
    const boom = new Error('boom');
    resolveMock.mockRejectedValue(boom);
    const req = { query: { branchId: 'branch-1' }, body: {} } as any;

    await new Promise<void>((done) => {
      PublicTenantMiddleware.fromBranch(req, {} as any, (err: any) => {
        expect(err).toBe(boom);
        done();
      });
    });
  });
});
