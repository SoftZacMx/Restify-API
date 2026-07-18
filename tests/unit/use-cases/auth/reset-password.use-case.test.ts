import { ResetPasswordUseCase } from '../../../../src/core/application/use-cases/auth/reset-password.use-case';
import { IUserRepository } from '../../../../src/core/domain/interfaces/user-repository.interface';
import { User } from '../../../../src/core/domain/entities/user.entity';
import { JwtUtil } from '../../../../src/shared/utils/jwt.util';
import { AppError } from '../../../../src/shared/errors';
import { UserRole, UserAccountStatus } from '@prisma/client';

function buildUser(overrides: Partial<User> = {}): User {
  return new User(
    overrides.id ?? 'user-1',
    overrides.name ?? 'John',
    overrides.last_name ?? 'Doe',
    overrides.second_last_name ?? null,
    overrides.email ?? 'john@example.com',
    overrides.password ?? 'hashed_password',
    overrides.phone ?? null,
    overrides.status ?? true,
    overrides.rol ?? UserRole.OWNER,
    overrides.organizationId ?? 'org-1',
    overrides.accountStatus ?? UserAccountStatus.ACTIVE,
    overrides.tokenVersion ?? 0,
    overrides.emailVerifiedAt ?? null,
    overrides.mustChangePassword ?? false,
    overrides.createdAt ?? new Date(),
    overrides.updatedAt ?? new Date()
  );
}

const VALID_PASSWORD = 'NewPass123!';

describe('ResetPasswordUseCase', () => {
  let useCase: ResetPasswordUseCase;
  let mockUserRepository: jest.Mocked<IUserRepository>;

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

    useCase = new ResetPasswordUseCase(mockUserRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('resets the password with a valid token', async () => {
    const token = JwtUtil.generatePasswordResetToken({ sub: 'user-1', email: 'john@example.com' });
    mockUserRepository.findById.mockResolvedValue(buildUser({ id: 'user-1' }));

    await useCase.execute({ token, password: VALID_PASSWORD });

    expect(mockUserRepository.changePasswordAndClearFlag).toHaveBeenCalledTimes(1);
    const [id, hashed] = mockUserRepository.changePasswordAndClearFlag.mock.calls[0];
    expect(id).toBe('user-1');
    // La contraseña se guarda hasheada, nunca en claro.
    expect(hashed).not.toBe(VALID_PASSWORD);
  });

  it('rejects an invalid token', async () => {
    await expect(
      useCase.execute({ token: 'garbage', password: VALID_PASSWORD })
    ).rejects.toThrow(AppError);
    expect(mockUserRepository.changePasswordAndClearFlag).not.toHaveBeenCalled();
  });

  it('rejects a token with the wrong purpose (email verification token)', async () => {
    const wrongToken = JwtUtil.generateEmailVerificationToken({ sub: 'user-1', email: 'john@example.com' });

    await expect(
      useCase.execute({ token: wrongToken, password: VALID_PASSWORD })
    ).rejects.toThrow(AppError);
    expect(mockUserRepository.changePasswordAndClearFlag).not.toHaveBeenCalled();
  });

  it('rejects when the user no longer exists', async () => {
    const token = JwtUtil.generatePasswordResetToken({ sub: 'ghost', email: 'ghost@example.com' });
    mockUserRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute({ token, password: VALID_PASSWORD })).rejects.toThrow(AppError);
    expect(mockUserRepository.changePasswordAndClearFlag).not.toHaveBeenCalled();
  });

  it('rejects when the user is inactive', async () => {
    const token = JwtUtil.generatePasswordResetToken({ sub: 'user-1', email: 'john@example.com' });
    mockUserRepository.findById.mockResolvedValue(buildUser({ status: false }));

    await expect(useCase.execute({ token, password: VALID_PASSWORD })).rejects.toThrow(AppError);
    expect(mockUserRepository.changePasswordAndClearFlag).not.toHaveBeenCalled();
  });
});
