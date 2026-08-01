import { ListBranchesUseCase } from '../../../../src/core/application/use-cases/branches/list-branches.use-case';
import { IBranchRepository } from '../../../../src/core/domain/interfaces/branch-repository.interface';
import { BranchAccessService } from '../../../../src/core/application/services/branch-access.service';
import { OrganizationRole } from '../../../../src/shared/constants/roles.constants';

jest.mock('../../../../src/core/infrastructure/tenant/tenant-context', () => ({
  getOrganizationId: jest.fn(() => 'org-1'),
}));

describe('ListBranchesUseCase', () => {
  let useCase: ListBranchesUseCase;
  let branchRepository: jest.Mocked<IBranchRepository>;
  let branchAccessService: jest.Mocked<BranchAccessService>;

  const input = {
    userId: 'user-1',
    role: OrganizationRole.OWNER,
  };

  const rows = [
    {
      id: 'branch-1',
      name: 'Norte',
      city: 'CDMX',
      state: 'CDMX',
      status: 'active',
      assignedUsersCount: 2,
      lastOrderAt: new Date('2026-07-01T12:00:00Z'),
    },
    {
      id: 'branch-2',
      name: 'Sur',
      city: 'CDMX',
      state: 'CDMX',
      status: 'disabled',
      assignedUsersCount: 0,
      lastOrderAt: null,
    },
  ];

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

    useCase = new ListBranchesUseCase(branchRepository, branchAccessService);
  });

  it('lista las sucursales accesibles de la organización', async () => {
    branchAccessService.getAccessibleBranchIds.mockResolvedValue(['branch-1', 'branch-2']);
    branchRepository.findManyForList.mockResolvedValue(rows as any);

    const result = await useCase.execute(input);

    expect(branchAccessService.getAccessibleBranchIds).toHaveBeenCalledWith(
      'org-1',
      'user-1',
      OrganizationRole.OWNER
    );
    expect(branchRepository.findManyForList).toHaveBeenCalledWith('org-1', ['branch-1', 'branch-2'], {
      includeDisabled: undefined,
    });
    expect(result).toEqual([
      expect.objectContaining({ id: 'branch-1', lastOrderAt: '2026-07-01T12:00:00.000Z' }),
      expect.objectContaining({ id: 'branch-2', lastOrderAt: null }),
    ]);
  });

  it('devuelve [] sin consultar si el usuario no tiene sucursales accesibles', async () => {
    branchAccessService.getAccessibleBranchIds.mockResolvedValue([]);

    const result = await useCase.execute(input);

    expect(result).toEqual([]);
    expect(branchRepository.findManyForList).not.toHaveBeenCalled();
  });

  it('pasa includeDisabled: true al repositorio cuando se pide', async () => {
    branchAccessService.getAccessibleBranchIds.mockResolvedValue(['branch-1']);
    branchRepository.findManyForList.mockResolvedValue([rows[0]] as any);

    await useCase.execute({ ...input, includeDisabled: true });

    expect(branchRepository.findManyForList).toHaveBeenCalledWith('org-1', ['branch-1'], {
      includeDisabled: true,
    });
  });
});
