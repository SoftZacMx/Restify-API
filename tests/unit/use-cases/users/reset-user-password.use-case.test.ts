import { ResetUserPasswordUseCase } from '../../../../src/core/application/use-cases/users/reset-user-password.use-case';
import { IUserRepository } from '../../../../src/core/domain/interfaces/user-repository.interface';
import { User } from '../../../../src/core/domain/entities/user.entity';
import { UserRole, UserAccountStatus } from '@prisma/client';
import { AppError } from '../../../../src/shared/errors';
import { runWithTenant } from '../../../../src/core/infrastructure/tenant/tenant-context';

const ORG_ID = 'org-1';

function buildUser(overrides: Partial<User> = {}): User {
  return new User(
    overrides.id ?? '123',
    overrides.name ?? 'John',
    overrides.last_name ?? 'Doe',
    overrides.second_last_name ?? null,
    overrides.email ?? 'john@example.com',
    overrides.password ?? 'hashed_password',
    overrides.phone ?? null,
    overrides.status ?? true,
    overrides.rol ?? UserRole.WAITER,
    overrides.organizationId ?? ORG_ID,
    overrides.accountStatus ?? UserAccountStatus.ACTIVE,
    overrides.tokenVersion ?? 0,
    overrides.emailVerifiedAt ?? null,
    overrides.mustChangePassword ?? false,
    overrides.createdAt ?? new Date(),
    overrides.updatedAt ?? new Date()
  );
}

describe('ResetUserPasswordUseCase', () => {
  let useCase: ResetUserPasswordUseCase;
  let mockUserRepository: jest.Mocked<IUserRepository>;

  const run = (userId: string) =>
    runWithTenant({ organizationId: ORG_ID }, () => useCase.execute({ user_id: userId }));

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
    } as unknown as jest.Mocked<IUserRepository>;

    useCase = new ResetUserPasswordUseCase(mockUserRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should reset password for an employee of the same org', async () => {
    mockUserRepository.findById.mockResolvedValue(buildUser({ organizationId: ORG_ID }));

    await run('123');

    expect(mockUserRepository.markForPasswordReset).toHaveBeenCalledWith('123');
  });

  it('should throw USER_NOT_FOUND when the user belongs to another org', async () => {
    mockUserRepository.findById.mockResolvedValue(buildUser({ organizationId: 'other-org' }));

    try {
      await run('123');
      fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe('USER_NOT_FOUND');
    }

    expect(mockUserRepository.markForPasswordReset).not.toHaveBeenCalled();
  });

  it('should throw USER_NOT_FOUND when the user does not exist', async () => {
    mockUserRepository.findById.mockResolvedValue(null);

    try {
      await run('123');
      fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe('USER_NOT_FOUND');
    }

    expect(mockUserRepository.markForPasswordReset).not.toHaveBeenCalled();
  });
});
