import { CreateBranchUseCase } from '../../../../src/core/application/use-cases/branches/create-branch.use-case';
import { IBranchRepository } from '../../../../src/core/domain/interfaces/branch-repository.interface';
import { BranchLimitService } from '../../../../src/core/application/services/branch-limit.service';
import { Branch } from '../../../../src/core/domain/entities/branch.entity';
import { AppError } from '../../../../src/shared/errors';

jest.mock('../../../../src/core/infrastructure/tenant/tenant-context', () => ({
  getOrganizationId: jest.fn(() => 'org-1'),
}));

describe('CreateBranchUseCase', () => {
  let useCase: CreateBranchUseCase;
  let mockBranchRepository: jest.Mocked<IBranchRepository>;
  let mockBranchLimitService: jest.Mocked<BranchLimitService>;

  const validInput = {
    name: 'Sucursal Norte',
    state: 'CDMX',
    city: 'Ciudad de México',
    street: 'Reforma',
    exteriorNumber: '10',
    phone: '5555555555',
    timezone: 'America/Mexico_City',
  };

  const now = new Date();

  const mockBranch = new Branch(
    'branch-1',
    'org-1',
    validInput.name,
    validInput.state,
    validInput.city,
    validInput.street,
    validInput.exteriorNumber,
    validInput.phone,
    null,
    null,
    null,
    null,
    null,
    null,
    validInput.timezone,
    'MXN',
    'active',
    now,
    now,
    null
  );

  beforeEach(() => {
    mockBranchRepository = {
      findById: jest.fn(),
      findByIdAndOrganizationId: jest.fn(),
      findAllIdsByOrganizationId: jest.fn(),
      findManyByOrganizationId: jest.fn(),
      findManyForList: jest.fn(),
      countActiveByOrganizationId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };

    mockBranchLimitService = {
      getMaxBranches: jest.fn(),
    } as unknown as jest.Mocked<BranchLimitService>;

    useCase = new CreateBranchUseCase(mockBranchRepository, mockBranchLimitService);
  });

  it('should create branch when under plan limit', async () => {
    mockBranchRepository.countActiveByOrganizationId.mockResolvedValue(2);
    mockBranchLimitService.getMaxBranches.mockResolvedValue(3);
    mockBranchRepository.create.mockResolvedValue(mockBranch);

    const result = await useCase.execute(validInput);

    expect(result.id).toBe('branch-1');
    expect(mockBranchRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1', name: validInput.name })
    );
  });

  it('should throw BRANCH_LIMIT_REACHED when active count equals max', async () => {
    mockBranchRepository.countActiveByOrganizationId.mockResolvedValue(3);
    mockBranchLimitService.getMaxBranches.mockResolvedValue(3);

    await expect(useCase.execute(validInput)).rejects.toMatchObject({
      code: 'BRANCH_LIMIT_REACHED',
      statusCode: 409,
    });

    expect(mockBranchRepository.create).not.toHaveBeenCalled();
  });
});
