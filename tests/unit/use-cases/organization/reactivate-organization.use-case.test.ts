import { ReactivateOrganizationUseCase } from '../../../../src/core/application/use-cases/organization/reactivate-organization.use-case';
import { IUserRepository } from '../../../../src/core/domain/interfaces/user-repository.interface';
import { IOrganizationRepository, OrganizationRecord } from '../../../../src/core/domain/interfaces/organization-repository.interface';
import { IBranchRepository } from '../../../../src/core/domain/interfaces/branch-repository.interface';
import { User } from '../../../../src/core/domain/entities/user.entity';
import { OrganizationPlan, UserRole, UserAccountStatus } from '@prisma/client';
import { BcryptUtil } from '../../../../src/shared/utils/bcrypt.util';
import { JwtUtil } from '../../../../src/shared/utils/jwt.util';

jest.mock('../../../../src/shared/utils/bcrypt.util');
jest.mock('../../../../src/shared/utils/jwt.util');

const ORG_ID = 'org-1';

function buildUser(overrides: Partial<User> = {}): User {
  return new User(
    overrides.id ?? 'user-1',
    overrides.name ?? 'Owner',
    overrides.last_name ?? 'One',
    overrides.second_last_name ?? null,
    overrides.email ?? 'owner@example.com',
    overrides.password ?? 'hashed_password',
    overrides.phone ?? null,
    overrides.status ?? true,
    overrides.rol ?? UserRole.OWNER,
    overrides.organizationId ?? ORG_ID,
    overrides.accountStatus ?? UserAccountStatus.ACTIVE,
    overrides.tokenVersion ?? 1,
    overrides.emailVerifiedAt ?? new Date(),
    overrides.mustChangePassword ?? false,
    overrides.createdAt ?? new Date(),
    overrides.updatedAt ?? new Date()
  );
}

function buildOrg(overrides: Partial<OrganizationRecord> = {}): OrganizationRecord {
  return {
    id: overrides.id ?? ORG_ID,
    name: overrides.name ?? 'Acme',
    plan: overrides.plan ?? OrganizationPlan.FREE,
    status: overrides.status ?? 'CANCELLED',
    // Respetar `null` explícito (no usar ?? que lo trataría como ausente).
    deletedAt: 'deletedAt' in overrides ? overrides.deletedAt! : new Date(),
  };
}

describe('ReactivateOrganizationUseCase', () => {
  let useCase: ReactivateOrganizationUseCase;
  let mockUserRepository: jest.Mocked<IUserRepository>;
  let mockOrgRepository: jest.Mocked<IOrganizationRepository>;
  let mockBranchRepository: jest.Mocked<IBranchRepository>;

  const input = { email: 'owner@example.com', password: 'secret' };

  beforeEach(() => {
    mockUserRepository = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findAll: jest.fn(),
      reactivate: jest.fn(),
      markForPasswordReset: jest.fn(),
      markEmailVerified: jest.fn(),
    } as unknown as jest.Mocked<IUserRepository>;

    mockOrgRepository = {
      findById: jest.fn(),
      findFirstActive: jest.fn(),
      findByIdIncludingDeleted: jest.fn(),
      close: jest.fn(),
      reactivate: jest.fn(),
    } as unknown as jest.Mocked<IOrganizationRepository>;

    mockBranchRepository = {
      findAllIdsByOrganizationId: jest.fn().mockResolvedValue(['branch-1']),
    } as unknown as jest.Mocked<IBranchRepository>;

    (BcryptUtil.compare as jest.Mock).mockResolvedValue(true);
    (JwtUtil.generateToken as jest.Mock).mockReturnValue('signed-jwt');

    useCase = new ReactivateOrganizationUseCase(
      mockUserRepository,
      mockOrgRepository,
      mockBranchRepository
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('reactivates a closed org within the window and returns a fresh token', async () => {
    mockUserRepository.findByEmail.mockResolvedValue(buildUser());
    mockOrgRepository.findByIdIncludingDeleted.mockResolvedValue(buildOrg());

    const result = await useCase.execute(input);

    expect(mockOrgRepository.reactivate).toHaveBeenCalledWith(ORG_ID);
    expect(result.token).toBe('signed-jwt');
    expect(result.organization.status).toBe('ACTIVE');
  });

  it('rejects invalid credentials', async () => {
    mockUserRepository.findByEmail.mockResolvedValue(buildUser());
    (BcryptUtil.compare as jest.Mock).mockResolvedValue(false);

    await expect(useCase.execute(input)).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(mockOrgRepository.reactivate).not.toHaveBeenCalled();
  });

  it('rejects a non-owner with FORBIDDEN', async () => {
    mockUserRepository.findByEmail.mockResolvedValue(buildUser({ rol: UserRole.ADMIN }));

    await expect(useCase.execute(input)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(mockOrgRepository.reactivate).not.toHaveBeenCalled();
  });

  it('throws ORGANIZATION_NOT_CLOSED when org is still active', async () => {
    mockUserRepository.findByEmail.mockResolvedValue(buildUser());
    mockOrgRepository.findByIdIncludingDeleted.mockResolvedValue(
      buildOrg({ status: 'ACTIVE', deletedAt: null })
    );

    await expect(useCase.execute(input)).rejects.toMatchObject({ code: 'ORGANIZATION_NOT_CLOSED' });
    expect(mockOrgRepository.reactivate).not.toHaveBeenCalled();
  });

  it('throws ORGANIZATION_REACTIVATION_EXPIRED when past the 30-day window', async () => {
    const longAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    mockUserRepository.findByEmail.mockResolvedValue(buildUser());
    mockOrgRepository.findByIdIncludingDeleted.mockResolvedValue(buildOrg({ deletedAt: longAgo }));

    await expect(useCase.execute(input)).rejects.toMatchObject({
      code: 'ORGANIZATION_REACTIVATION_EXPIRED',
    });
    expect(mockOrgRepository.reactivate).not.toHaveBeenCalled();
  });
});
