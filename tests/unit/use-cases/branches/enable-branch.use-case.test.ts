import { EnableBranchUseCase } from '../../../../src/core/application/use-cases/branches/enable-branch.use-case';
import { IBranchRepository } from '../../../../src/core/domain/interfaces/branch-repository.interface';
import { BranchAccessService } from '../../../../src/core/application/services/branch-access.service';
import { BranchLimitService } from '../../../../src/core/application/services/branch-limit.service';
import { Branch } from '../../../../src/core/domain/entities/branch.entity';
import { OrganizationRole } from '../../../../src/shared/constants/roles.constants';

jest.mock('../../../../src/core/infrastructure/tenant/tenant-context', () => ({
  getOrganizationId: jest.fn(() => 'org-1'),
}));

function makeBranch(status: 'active' | 'disabled'): Branch {
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
    status,
    now,
    now,
    null,
    'tacos-el-rey'
  );
}

describe('EnableBranchUseCase', () => {
  let useCase: EnableBranchUseCase;
  let branchRepository: jest.Mocked<IBranchRepository>;
  let branchAccessService: jest.Mocked<BranchAccessService>;
  let branchLimitService: jest.Mocked<BranchLimitService>;

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

    branchLimitService = {
      getMaxBranches: jest.fn(),
    } as unknown as jest.Mocked<BranchLimitService>;

    useCase = new EnableBranchUseCase(branchRepository, branchAccessService, branchLimitService);
  });

  it('activa una sucursal deshabilitada cuando hay cupo', async () => {
    branchRepository.findByIdAndOrganizationId.mockResolvedValue(makeBranch('disabled'));
    branchRepository.countActiveByOrganizationId.mockResolvedValue(1);
    branchLimitService.getMaxBranches.mockResolvedValue(3);
    branchRepository.update.mockResolvedValue(makeBranch('active'));

    const result = await useCase.execute(input);

    expect(branchRepository.update).toHaveBeenCalledWith('branch-1', { status: 'active' });
    expect(result).toMatchObject({ id: 'branch-1', status: 'active' });
  });

  it('lanza BRANCH_NOT_FOUND si la sucursal no existe', async () => {
    branchRepository.findByIdAndOrganizationId.mockResolvedValue(null);

    await expect(useCase.execute(input)).rejects.toMatchObject({ code: 'BRANCH_NOT_FOUND' });
    expect(branchRepository.update).not.toHaveBeenCalled();
  });

  it('lanza BRANCH_ALREADY_ACTIVE si la sucursal ya está activa', async () => {
    branchRepository.findByIdAndOrganizationId.mockResolvedValue(makeBranch('active'));

    await expect(useCase.execute(input)).rejects.toMatchObject({ code: 'BRANCH_ALREADY_ACTIVE' });
    expect(branchRepository.update).not.toHaveBeenCalled();
  });

  it('lanza BRANCH_LIMIT_REACHED si el cupo está completo', async () => {
    branchRepository.findByIdAndOrganizationId.mockResolvedValue(makeBranch('disabled'));
    branchRepository.countActiveByOrganizationId.mockResolvedValue(3);
    branchLimitService.getMaxBranches.mockResolvedValue(3);

    await expect(useCase.execute(input)).rejects.toMatchObject({ code: 'BRANCH_LIMIT_REACHED' });
    expect(branchRepository.update).not.toHaveBeenCalled();
  });

  it('propaga FORBIDDEN cuando el usuario no tiene acceso', async () => {
    branchAccessService.assertCanAccessBranch.mockRejectedValue(
      Object.assign(new Error('No tienes acceso a esta sucursal'), { code: 'FORBIDDEN' })
    );

    await expect(useCase.execute(input)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
