import { ResolvePublicBranchUseCase } from '../../../../src/core/application/use-cases/branches/resolve-public-branch.use-case';
import { IBranchRepository } from '../../../../src/core/domain/interfaces/branch-repository.interface';
import { IOrganizationRepository } from '../../../../src/core/domain/interfaces/organization-repository.interface';
import { Branch } from '../../../../src/core/domain/entities/branch.entity';

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
    null, // rfc
    'https://logo.png',
    null, // startOperations
    null, // endOperations
    null, // ticketConfig
    null, // paymentConfig
    'America/Mexico_City',
    'MXN',
    (overrides.status as any) ?? 'active',
    now,
    now,
    null, // deletedAt
    'tacos-el-rey'
  );
}

describe('ResolvePublicBranchUseCase', () => {
  let useCase: ResolvePublicBranchUseCase;
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

    useCase = new ResolvePublicBranchUseCase(branchRepository, organizationRepository);
  });

  it('resuelve el slug a los datos públicos de la sucursal', async () => {
    branchRepository.findBySlug.mockResolvedValue(makeBranch());
    organizationRepository.findById.mockResolvedValue({
      id: 'org-1',
      name: 'Mi Org',
      plan: 'FREE',
      status: 'ACTIVE',
      deletedAt: null,
    } as any);

    const result = await useCase.execute({ slug: 'tacos-el-rey' });

    expect(result).toEqual({
      branchId: 'branch-1',
      name: 'Tacos El Rey',
      organizationName: 'Mi Org',
      logoUrl: 'https://logo.png',
      timezone: 'America/Mexico_City',
      currency: 'MXN',
    });
  });

  it('lanza BRANCH_NOT_FOUND si el slug no existe', async () => {
    branchRepository.findBySlug.mockResolvedValue(null);

    await expect(useCase.execute({ slug: 'no-existe' })).rejects.toMatchObject({
      code: 'BRANCH_NOT_FOUND',
    });
  });

  it('lanza BRANCH_NOT_FOUND si la sucursal está deshabilitada', async () => {
    branchRepository.findBySlug.mockResolvedValue(makeBranch({ status: 'disabled' }));

    await expect(useCase.execute({ slug: 'tacos-el-rey' })).rejects.toMatchObject({
      code: 'BRANCH_NOT_FOUND',
    });
    expect(organizationRepository.findById).not.toHaveBeenCalled();
  });

  it('lanza ORGANIZATION_INACTIVE si la organización no está activa', async () => {
    branchRepository.findBySlug.mockResolvedValue(makeBranch());
    organizationRepository.findById.mockResolvedValue({
      id: 'org-1',
      name: 'Mi Org',
      plan: 'FREE',
      status: 'CANCELLED',
      deletedAt: null,
    } as any);

    await expect(useCase.execute({ slug: 'tacos-el-rey' })).rejects.toMatchObject({
      code: 'ORGANIZATION_INACTIVE',
    });
  });
});
