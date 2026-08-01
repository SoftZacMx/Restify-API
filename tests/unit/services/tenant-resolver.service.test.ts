import { TenantResolverService } from '../../../src/core/application/services/tenant-resolver.service';
import { IBranchRepository } from '../../../src/core/domain/interfaces/branch-repository.interface';
import { IOrganizationRepository } from '../../../src/core/domain/interfaces/organization-repository.interface';
import { Branch } from '../../../src/core/domain/entities/branch.entity';

function makeBranch(overrides: Partial<Record<string, unknown>> = {}): Branch {
  const now = new Date();
  return new Branch(
    'branch-1',
    'org-1',
    'Tacos El Rey',
    'CDMX',
    'CDMX',
    'Reforma',
    '123',
    '5512345678',
    null,
    'https://logo.png',
    null,
    null,
    null,
    null,
    'America/Mexico_City',
    'MXN',
    (overrides.status as any) ?? 'active',
    now,
    now,
    null,
    'tacos-el-rey'
  );
}

describe('TenantResolverService', () => {
  let service: TenantResolverService;
  let branchRepository: jest.Mocked<IBranchRepository>;
  let organizationRepository: jest.Mocked<IOrganizationRepository>;

  beforeEach(() => {
    branchRepository = {
      findById: jest.fn(),
      findBySlug: jest.fn(),
      findByIdAndOrganizationId: jest.fn(),
      findAllIdsByOrganizationId: jest.fn(),
      findManyByOrganizationId: jest.fn(),
      findManyForList: jest.fn(),
      countActiveByOrganizationId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };

    organizationRepository = {
      findById: jest.fn(),
      findFirstActive: jest.fn(),
      findByIdIncludingDeleted: jest.fn(),
      close: jest.fn(),
      reactivate: jest.fn(),
    } as unknown as jest.Mocked<IOrganizationRepository>;

    service = new TenantResolverService(branchRepository, organizationRepository);
  });

  it('resuelve el tenant a partir de un branch activo con org ACTIVE', async () => {
    const branch = makeBranch();
    branchRepository.findById.mockResolvedValue(branch);
    organizationRepository.findById.mockResolvedValue({
      id: 'org-1',
      status: 'ACTIVE',
    } as any);

    const result = await service.resolve('branch-1');

    expect(result).toEqual({
      ok: true,
      tenant: { organizationId: 'org-1', branchId: 'branch-1' },
      branch,
    });
  });

  it('devuelve BRANCH_NOT_FOUND si el branch no existe', async () => {
    branchRepository.findById.mockResolvedValue(null);

    const result = await service.resolve('no-existe');

    expect(result).toEqual({ ok: false, reason: 'BRANCH_NOT_FOUND' });
    expect(organizationRepository.findById).not.toHaveBeenCalled();
  });

  it('devuelve BRANCH_NOT_FOUND si requireActiveBranch y el branch está deshabilitado', async () => {
    branchRepository.findById.mockResolvedValue(makeBranch({ status: 'disabled' }));

    const result = await service.resolve('branch-1', { requireActiveBranch: true });

    expect(result).toEqual({ ok: false, reason: 'BRANCH_NOT_FOUND' });
    expect(organizationRepository.findById).not.toHaveBeenCalled();
  });

  it('resuelve aunque el branch esté deshabilitado si requireActiveBranch es false (webhooks)', async () => {
    const branch = makeBranch({ status: 'disabled' });
    branchRepository.findById.mockResolvedValue(branch);
    organizationRepository.findById.mockResolvedValue({
      id: 'org-1',
      status: 'ACTIVE',
    } as any);

    const result = await service.resolve('branch-1', { requireActiveBranch: false });

    expect(result).toEqual({ ok: true, tenant: { organizationId: 'org-1', branchId: 'branch-1' }, branch });
  });

  it('devuelve ORGANIZATION_INACTIVE si la organización no existe', async () => {
    branchRepository.findById.mockResolvedValue(makeBranch());
    organizationRepository.findById.mockResolvedValue(null);

    const result = await service.resolve('branch-1');

    expect(result).toEqual({
      ok: false,
      reason: 'ORGANIZATION_INACTIVE',
      organizationId: 'org-1',
      orgStatus: undefined,
    });
  });

  it('devuelve ORGANIZATION_INACTIVE con el status si la org no está ACTIVE', async () => {
    branchRepository.findById.mockResolvedValue(makeBranch());
    organizationRepository.findById.mockResolvedValue({
      id: 'org-1',
      status: 'CANCELLED',
    } as any);

    const result = await service.resolve('branch-1');

    expect(result).toEqual({
      ok: false,
      reason: 'ORGANIZATION_INACTIVE',
      organizationId: 'org-1',
      orgStatus: 'CANCELLED',
    });
  });
});
