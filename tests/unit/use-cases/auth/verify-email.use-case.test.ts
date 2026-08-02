import { VerifyEmailUseCase } from '../../../../src/core/application/use-cases/auth/verify-email.use-case';
import { IUserRepository } from '../../../../src/core/domain/interfaces/user-repository.interface';
import { User } from '../../../../src/core/domain/entities/user.entity';
import { JwtUtil } from '../../../../src/shared/utils/jwt.util';
import { UserRole, UserAccountStatus } from '@prisma/client';
import { AppError } from '../../../../src/shared/errors';

jest.mock('../../../../src/shared/utils/jwt.util');

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

describe('VerifyEmailUseCase', () => {
  let useCase: VerifyEmailUseCase;
  let mockUserRepository: jest.Mocked<IUserRepository>;

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

      changePasswordAndClearFlag: jest.fn(),      changePasswordAndRevokeSessions: jest.fn(),    } as unknown as jest.Mocked<IUserRepository>;

    useCase = new VerifyEmailUseCase(mockUserRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('verifies the email when the user is not yet verified', async () => {
    (JwtUtil.verifyEmailVerificationToken as jest.Mock).mockReturnValue({
      sub: 'user-1',
      email: 'john@example.com',
      purpose: 'email_verification',
    });
    mockUserRepository.findById.mockResolvedValue(buildUser({ emailVerifiedAt: null }));

    const result = await useCase.execute({ token: 'valid-token' });

    expect(result).toEqual({ email: 'john@example.com', alreadyVerified: false });
    expect(mockUserRepository.markEmailVerified).toHaveBeenCalledWith('user-1');
  });

  it('is idempotent: returns alreadyVerified without re-marking', async () => {
    (JwtUtil.verifyEmailVerificationToken as jest.Mock).mockReturnValue({
      sub: 'user-1',
      email: 'john@example.com',
      purpose: 'email_verification',
    });
    mockUserRepository.findById.mockResolvedValue(buildUser({ emailVerifiedAt: new Date() }));

    const result = await useCase.execute({ token: 'valid-token' });

    expect(result).toEqual({ email: 'john@example.com', alreadyVerified: true });
    expect(mockUserRepository.markEmailVerified).not.toHaveBeenCalled();
  });

  it('throws INVALID_TOKEN when the token is invalid/expired/wrong purpose', async () => {
    (JwtUtil.verifyEmailVerificationToken as jest.Mock).mockImplementation(() => {
      throw new Error('Invalid token');
    });

    await expect(useCase.execute({ token: 'bad-token' })).rejects.toMatchObject({
      code: 'INVALID_TOKEN',
    });
    expect(mockUserRepository.findById).not.toHaveBeenCalled();
    expect(mockUserRepository.markEmailVerified).not.toHaveBeenCalled();
  });

  it('throws USER_NOT_FOUND when the token is valid but the user no longer exists', async () => {
    (JwtUtil.verifyEmailVerificationToken as jest.Mock).mockReturnValue({
      sub: 'ghost',
      email: 'ghost@example.com',
      purpose: 'email_verification',
    });
    mockUserRepository.findById.mockResolvedValue(null);

    try {
      await useCase.execute({ token: 'valid-token' });
      fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe('USER_NOT_FOUND');
    }
    expect(mockUserRepository.markEmailVerified).not.toHaveBeenCalled();
  });
});
