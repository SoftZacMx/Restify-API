import { GetBranchUseCase } from '../../../../src/core/application/use-cases/branches/get-branch.use-case';
import { IBranchRepository } from '../../../../src/core/domain/interfaces/branch-repository.interface';
import { BranchAccessService } from '../../../../src/core/application/services/branch-access.service';
import { Branch } from '../../../../src/core/domain/entities/branch.entity';
import { OrganizationRole } from '../../../../src/shared/constants/roles.constants';

jest.mock('../../../../src/core/infrastructure/tenant/tenant-context', () => ({
  getOrganizationId: jest.fn(() => 'org-1'),
}));

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
    null,
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

describe('GetBranchUseCase', () => {
  let useCase: GetBranchUseCase;
  let branchRepository: jest.Mocked<IBranchRepository>;
  let branchAccessService: jest.Mocked<BranchAccessService>;

  const input = {
    branchId: 'branch-1',
    userId: 'user-1',
    role: OrganizationRole.OWNER,
  };

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

    branchAccessService = {
      assertCanAccessBranch: jest.fn(),
      getAccessibleBranchIds: jest.fn(),
    } as unknown as jest.Mocked<BranchAccessService>;

    useCase = new GetBranchUseCase(branchRepository, branchAccessService);
  });

  it('devuelve el detalle de la sucursal de la organización', async () => {
    const branch = makeBranch();
    branchRepository.findByIdAndOrganizationId.mockResolvedValue(branch);

    const result = await useCase.execute(input);

    expect(branchAccessService.assertCanAccessBranch).toHaveBeenCalledWith(
      'org-1',
      'user-1',
      OrganizationRole.OWNER,
      'branch-1'
    );
    expect(branchRepository.findByIdAndOrganizationId).toHaveBeenCalledWith('branch-1', 'org-1');
    expect(result).toMatchObject({ id: 'branch-1', name: 'Tacos El Rey', organizationId: 'org-1' });
  });

  it('lanza BRANCH_NOT_FOUND si la sucursal no existe en la org', async () => {
    branchRepository.findByIdAndOrganizationId.mockResolvedValue(null);

    await expect(useCase.execute(input)).rejects.toMatchObject({ code: 'BRANCH_NOT_FOUND' });
  });

  it('propaga FORBIDDEN cuando el usuario no tiene acceso a la sucursal', async () => {
    branchAccessService.assertCanAccessBranch.mockRejectedValue(
      Object.assign(new Error('No tienes acceso a esta sucursal'), { code: 'FORBIDDEN' })
    );

    await expect(useCase.execute(input)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(branchRepository.findByIdAndOrganizationId).not.toHaveBeenCalled();
  });
});
