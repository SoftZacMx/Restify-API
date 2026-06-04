import { CloseOrganizationUseCase } from '../../../../src/core/application/use-cases/organization/close-organization.use-case';
import { IOrganizationRepository, OrganizationRecord } from '../../../../src/core/domain/interfaces/organization-repository.interface';
import { OrganizationPlan } from '@prisma/client';
import { AppError } from '../../../../src/shared/errors';
import { runWithTenant } from '../../../../src/core/infrastructure/tenant/tenant-context';
import { OrganizationRole } from '../../../../src/shared/constants/roles.constants';

const ORG_ID = 'org-1';
const ORG_NAME = 'Acme Tacos';

function buildOrg(overrides: Partial<OrganizationRecord> = {}): OrganizationRecord {
  return {
    id: overrides.id ?? ORG_ID,
    name: overrides.name ?? ORG_NAME,
    plan: overrides.plan ?? OrganizationPlan.FREE,
    status: overrides.status ?? 'ACTIVE',
    deletedAt: overrides.deletedAt ?? null,
  };
}

describe('CloseOrganizationUseCase', () => {
  let useCase: CloseOrganizationUseCase;
  let mockOrgRepository: jest.Mocked<IOrganizationRepository>;

  const run = (input: { confirmationName: string; role?: OrganizationRole }) =>
    runWithTenant({ organizationId: ORG_ID }, () =>
      useCase.execute({
        confirmationName: input.confirmationName,
        userId: 'user-1',
        role: input.role ?? OrganizationRole.OWNER,
      })
    );

  beforeEach(() => {
    mockOrgRepository = {
      findById: jest.fn(),
      findFirstActive: jest.fn(),
      findByIdIncludingDeleted: jest.fn(),
      close: jest.fn(),
      reactivate: jest.fn(),
    } as unknown as jest.Mocked<IOrganizationRepository>;

    useCase = new CloseOrganizationUseCase(mockOrgRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('closes the org when name matches and caller is owner', async () => {
    mockOrgRepository.findById.mockResolvedValue(buildOrg());
    mockOrgRepository.close.mockResolvedValue(
      buildOrg({ status: 'CANCELLED', deletedAt: new Date() })
    );

    const result = await run({ confirmationName: ORG_NAME });

    expect(mockOrgRepository.close).toHaveBeenCalledWith(ORG_ID);
    expect(result.status).toBe('CANCELLED');
    expect(result.closedAt).not.toBeNull();
  });

  it('rejects a non-owner with FORBIDDEN', async () => {
    await expect(run({ confirmationName: ORG_NAME, role: OrganizationRole.ADMIN })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(mockOrgRepository.close).not.toHaveBeenCalled();
  });

  it('throws ORGANIZATION_NAME_MISMATCH when confirmation name differs', async () => {
    mockOrgRepository.findById.mockResolvedValue(buildOrg());

    await expect(run({ confirmationName: 'Wrong Name' })).rejects.toMatchObject({
      code: 'ORGANIZATION_NAME_MISMATCH',
    });
    expect(mockOrgRepository.close).not.toHaveBeenCalled();
  });

  it('throws ORGANIZATION_ALREADY_CLOSED when org is already closed', async () => {
    mockOrgRepository.findById.mockResolvedValue(buildOrg({ deletedAt: new Date() }));

    await expect(run({ confirmationName: ORG_NAME })).rejects.toMatchObject({
      code: 'ORGANIZATION_ALREADY_CLOSED',
    });
    expect(mockOrgRepository.close).not.toHaveBeenCalled();
  });

  it('throws ORGANIZATION_NOT_FOUND when org does not exist', async () => {
    mockOrgRepository.findById.mockResolvedValue(null);

    await expect(run({ confirmationName: ORG_NAME })).rejects.toBeInstanceOf(AppError);
    expect(mockOrgRepository.close).not.toHaveBeenCalled();
  });
});
