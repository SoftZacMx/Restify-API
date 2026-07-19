import { validateBranchAndHours } from '../../../../src/core/application/use-cases/orders/create-public-order.use-case';
import { IBranchRepository } from '../../../../src/core/domain/interfaces/branch-repository.interface';
import { Branch } from '../../../../src/core/domain/entities/branch.entity';

describe('validateBranchAndHours', () => {
  let mockBranchRepository: jest.Mocked<IBranchRepository>;

  function makeBranch(overrides: Partial<{ startOperations: string | null; endOperations: string | null }> = {}): Branch {
    return new Branch(
      'branch-1', 'org-1', 'Sucursal Centro', 'CDMX', 'CDMX', 'Calle 1', '10',
      '5512345678', null, null,
      overrides.startOperations ?? null,
      overrides.endOperations ?? null,
      null, null, 'America/Mexico_City', 'MXN', 'active',
      new Date(), new Date(), null
    );
  }

  beforeEach(() => {
    mockBranchRepository = {
      findById: jest.fn(),
      findBySlug: jest.fn(),
      findByIdAndOrganizationId: jest.fn(),
      findAllIdsByOrganizationId: jest.fn(),
      findManyByOrganizationId: jest.fn(),
      findManyForList: jest.fn(),
      countActiveByOrganizationId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    } as any;
  });

  afterEach(() => jest.clearAllMocks());

  it('should throw BRANCH_NOT_FOUND when branch does not exist', async () => {
    mockBranchRepository.findById.mockResolvedValue(null);

    await expect(validateBranchAndHours(mockBranchRepository, 'nope'))
      .rejects.toMatchObject({ code: 'BRANCH_NOT_FOUND' });
  });

  it('should pass when no operating hours are configured', async () => {
    mockBranchRepository.findById.mockResolvedValue(makeBranch());

    await expect(validateBranchAndHours(mockBranchRepository, 'branch-1')).resolves.toBeUndefined();
  });

  it('should throw OUTSIDE_OPERATING_HOURS when scheduledAt falls outside the window', async () => {
    mockBranchRepository.findById.mockResolvedValue(
      makeBranch({ startOperations: '09:00', endOperations: '22:00' })
    );

    await expect(
      validateBranchAndHours(
        mockBranchRepository,
        'branch-1',
        new Date(2026, 3, 12, 23, 30).toISOString()
      )
    ).rejects.toMatchObject({ code: 'OUTSIDE_OPERATING_HOURS' });
  });

  it('should pass when scheduledAt falls inside the window', async () => {
    mockBranchRepository.findById.mockResolvedValue(
      makeBranch({ startOperations: '09:00', endOperations: '22:00' })
    );

    await expect(
      validateBranchAndHours(
        mockBranchRepository,
        'branch-1',
        new Date(2026, 3, 12, 12, 0).toISOString()
      )
    ).resolves.toBeUndefined();
  });
});
