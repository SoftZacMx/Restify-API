import { RequestPasswordResetUseCase } from '../../../../src/core/application/use-cases/auth/request-password-reset.use-case';
import { EmailService } from '../../../../src/core/infrastructure/messaging/email.service';
import { IUserRepository } from '../../../../src/core/domain/interfaces/user-repository.interface';
import { User } from '../../../../src/core/domain/entities/user.entity';
import { JwtUtil } from '../../../../src/shared/utils/jwt.util';
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

describe('RequestPasswordResetUseCase', () => {
  let useCase: RequestPasswordResetUseCase;
  let mockUserRepository: jest.Mocked<IUserRepository>;
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
      changePasswordAndClearFlag: jest.fn(),      changePasswordAndRevokeSessions: jest.fn(),
    } as unknown as jest.Mocked<IUserRepository>;

    mockEmailService = {
      send: jest.fn(),
    } as unknown as jest.Mocked<EmailService>;

    useCase = new RequestPasswordResetUseCase(mockUserRepository, mockEmailService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('sends a reset email with a valid password_reset token when the user exists and is active', async () => {
    mockUserRepository.findByEmail.mockResolvedValue(
      buildUser({ id: 'user-1', email: 'john@example.com', status: true })
    );

    await useCase.execute({ email: 'john@example.com' });

    expect(mockEmailService.send).toHaveBeenCalledTimes(1);
    const arg = mockEmailService.send.mock.calls[0][0];
    expect(arg.to).toBe('john@example.com');
    // El link debe contener un token válido con purpose password_reset.
    const match = arg.html.match(/token=([^"&]+)/);
    expect(match).not.toBeNull();
    const token = decodeURIComponent(match![1]);
    const payload = JwtUtil.verifyPasswordResetToken(token);
    expect(payload.sub).toBe('user-1');
    expect(payload.purpose).toBe('password_reset');
  });

  it('does not send (no-op) when the email does not exist', async () => {
    mockUserRepository.findByEmail.mockResolvedValue(null);

    await useCase.execute({ email: 'unknown@example.com' });

    expect(mockEmailService.send).not.toHaveBeenCalled();
  });

  it('does not send (no-op) when the user is inactive', async () => {
    mockUserRepository.findByEmail.mockResolvedValue(buildUser({ status: false }));

    await useCase.execute({ email: 'john@example.com' });

    expect(mockEmailService.send).not.toHaveBeenCalled();
  });

  it('does not propagate email errors (best-effort, anti-enumeration)', async () => {
    mockUserRepository.findByEmail.mockResolvedValue(buildUser());
    mockEmailService.send.mockRejectedValue(new Error('SES down'));

    await expect(useCase.execute({ email: 'john@example.com' })).resolves.toBeUndefined();
  });
});
