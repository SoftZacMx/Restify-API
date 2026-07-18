import { RequestOrganizationReactivationUseCase } from '../../../../src/core/application/use-cases/organization/request-organization-reactivation.use-case';
import { EmailService } from '../../../../src/core/infrastructure/messaging/email.service';
import { IUserRepository } from '../../../../src/core/domain/interfaces/user-repository.interface';
import { IOrganizationRepository, OrganizationRecord } from '../../../../src/core/domain/interfaces/organization-repository.interface';
import { User } from '../../../../src/core/domain/entities/user.entity';
import { JwtUtil } from '../../../../src/shared/utils/jwt.util';
import { OrganizationPlan, UserRole, UserAccountStatus } from '@prisma/client';

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
    overrides.tokenVersion ?? 0,
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
    deletedAt: 'deletedAt' in overrides ? overrides.deletedAt! : new Date(),
  };
}

describe('RequestOrganizationReactivationUseCase', () => {
  let useCase: RequestOrganizationReactivationUseCase;
  let mockUserRepository: jest.Mocked<IUserRepository>;
  let mockOrgRepository: jest.Mocked<IOrganizationRepository>;
  let mockEmailService: jest.Mocked<EmailService>;

  beforeEach(() => {
    process.env.JWT_SECRET = 'test_secret_at_least_32_characters_long_xx';

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
      changePasswordAndClearFlag: jest.fn(),
    } as unknown as jest.Mocked<IUserRepository>;

    mockOrgRepository = {
      findById: jest.fn(),
      findFirstActive: jest.fn(),
      findByIdIncludingDeleted: jest.fn(),
      close: jest.fn(),
      reactivate: jest.fn(),
    } as unknown as jest.Mocked<IOrganizationRepository>;

    mockEmailService = {
      send: jest.fn(),
    } as unknown as jest.Mocked<EmailService>;

    useCase = new RequestOrganizationReactivationUseCase(
      mockUserRepository,
      mockOrgRepository,
      mockEmailService
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('sends a reactivation email with a valid token when owner + closed org within window', async () => {
    mockUserRepository.findByEmail.mockResolvedValue(buildUser());
    mockOrgRepository.findByIdIncludingDeleted.mockResolvedValue(buildOrg());

    await useCase.execute({ email: 'owner@example.com' });

    expect(mockEmailService.send).toHaveBeenCalledTimes(1);
    const arg = mockEmailService.send.mock.calls[0][0];
    expect(arg.to).toBe('owner@example.com');
    const match = arg.html.match(/token=([^"&]+)/);
    expect(match).not.toBeNull();
    const token = decodeURIComponent(match![1]);
    const payload = JwtUtil.verifyOrganizationReactivationToken(token);
    expect(payload.sub).toBe('user-1');
    expect(payload.org).toBe(ORG_ID);
    expect(payload.purpose).toBe('organization_reactivation');
  });

  it('does not send (no-op) when the email does not exist', async () => {
    mockUserRepository.findByEmail.mockResolvedValue(null);

    await useCase.execute({ email: 'unknown@example.com' });

    expect(mockEmailService.send).not.toHaveBeenCalled();
  });

  it('does not send (no-op) when the user is not the owner', async () => {
    mockUserRepository.findByEmail.mockResolvedValue(buildUser({ rol: UserRole.ADMIN }));

    await useCase.execute({ email: 'owner@example.com' });

    expect(mockEmailService.send).not.toHaveBeenCalled();
  });

  it('does not send (no-op) when the org is not closed', async () => {
    mockUserRepository.findByEmail.mockResolvedValue(buildUser());
    mockOrgRepository.findByIdIncludingDeleted.mockResolvedValue(
      buildOrg({ status: 'ACTIVE', deletedAt: null })
    );

    await useCase.execute({ email: 'owner@example.com' });

    expect(mockEmailService.send).not.toHaveBeenCalled();
  });

  it('does not send (no-op) when past the 30-day window', async () => {
    const longAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    mockUserRepository.findByEmail.mockResolvedValue(buildUser());
    mockOrgRepository.findByIdIncludingDeleted.mockResolvedValue(buildOrg({ deletedAt: longAgo }));

    await useCase.execute({ email: 'owner@example.com' });

    expect(mockEmailService.send).not.toHaveBeenCalled();
  });

  it('does not propagate email errors (best-effort, anti-enumeration)', async () => {
    mockUserRepository.findByEmail.mockResolvedValue(buildUser());
    mockOrgRepository.findByIdIncludingDeleted.mockResolvedValue(buildOrg());
    mockEmailService.send.mockRejectedValue(new Error('SES down'));

    await expect(useCase.execute({ email: 'owner@example.com' })).resolves.toBeUndefined();
  });
});
