import { CleanupUnverifiedOrgsUseCase } from '../../../../src/core/application/use-cases/organization/cleanup-unverified-orgs.use-case';
import { IOrganizationRepository } from '../../../../src/core/domain/interfaces/organization-repository.interface';

describe('CleanupUnverifiedOrgsUseCase', () => {
  let useCase: CleanupUnverifiedOrgsUseCase;
  let mockOrgRepository: jest.Mocked<IOrganizationRepository>;

  const NOW = new Date('2026-06-10T04:00:00.000Z');

  beforeEach(() => {
    mockOrgRepository = {
      findById: jest.fn(),
      findFirstActive: jest.fn(),
      findByIdIncludingDeleted: jest.fn(),
      close: jest.fn().mockResolvedValue({} as never),
      reactivate: jest.fn(),
      findUnverifiedOwnerOrgIdsOlderThan: jest.fn(),
    } as unknown as jest.Mocked<IOrganizationRepository>;

    useCase = new CleanupUnverifiedOrgsUseCase(mockOrgRepository);
    delete process.env.UNVERIFIED_RETENTION_DAYS;
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.UNVERIFIED_RETENTION_DAYS;
  });

  it('queries with a 7-day threshold by default and closes each org found', async () => {
    mockOrgRepository.findUnverifiedOwnerOrgIdsOlderThan.mockResolvedValue(['org-1', 'org-2']);

    const result = await useCase.execute(NOW);

    // Umbral: NOW - 7 días.
    const expectedThreshold = new Date(NOW.getTime() - 7 * 24 * 60 * 60 * 1000);
    expect(mockOrgRepository.findUnverifiedOwnerOrgIdsOlderThan).toHaveBeenCalledWith(
      expectedThreshold
    );

    expect(mockOrgRepository.close).toHaveBeenCalledTimes(2);
    expect(mockOrgRepository.close).toHaveBeenCalledWith('org-1');
    expect(mockOrgRepository.close).toHaveBeenCalledWith('org-2');
    expect(result).toEqual({ thresholdDays: 7, found: 2, closed: 2, failed: 0 });
  });

  it('respects a custom retention window from env', async () => {
    process.env.UNVERIFIED_RETENTION_DAYS = '14';
    mockOrgRepository.findUnverifiedOwnerOrgIdsOlderThan.mockResolvedValue([]);

    const result = await useCase.execute(NOW);

    const expectedThreshold = new Date(NOW.getTime() - 14 * 24 * 60 * 60 * 1000);
    expect(mockOrgRepository.findUnverifiedOwnerOrgIdsOlderThan).toHaveBeenCalledWith(
      expectedThreshold
    );
    expect(result.thresholdDays).toBe(14);
  });

  it('falls back to 7 days when env value is invalid', async () => {
    process.env.UNVERIFIED_RETENTION_DAYS = 'not-a-number';
    mockOrgRepository.findUnverifiedOwnerOrgIdsOlderThan.mockResolvedValue([]);

    const result = await useCase.execute(NOW);

    expect(result.thresholdDays).toBe(7);
  });

  it('does nothing when there are no matching orgs', async () => {
    mockOrgRepository.findUnverifiedOwnerOrgIdsOlderThan.mockResolvedValue([]);

    const result = await useCase.execute(NOW);

    expect(mockOrgRepository.close).not.toHaveBeenCalled();
    expect(result).toEqual({ thresholdDays: 7, found: 0, closed: 0, failed: 0 });
  });

  it('does not abort the batch when one close fails', async () => {
    mockOrgRepository.findUnverifiedOwnerOrgIdsOlderThan.mockResolvedValue(['ok-1', 'bad', 'ok-2']);
    mockOrgRepository.close
      .mockResolvedValueOnce({} as never)
      .mockRejectedValueOnce(new Error('db error'))
      .mockResolvedValueOnce({} as never);

    const result = await useCase.execute(NOW);

    expect(mockOrgRepository.close).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ thresholdDays: 7, found: 3, closed: 2, failed: 1 });
  });
});
