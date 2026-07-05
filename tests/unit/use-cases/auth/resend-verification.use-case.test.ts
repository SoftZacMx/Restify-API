import { ResendVerificationUseCase } from '../../../../src/core/application/use-cases/auth/resend-verification.use-case';
import { SendVerificationEmailUseCase } from '../../../../src/core/application/use-cases/auth/send-verification-email.use-case';
import { IUserRepository } from '../../../../src/core/domain/interfaces/user-repository.interface';
import { User } from '../../../../src/core/domain/entities/user.entity';
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

describe('ResendVerificationUseCase', () => {
  let useCase: ResendVerificationUseCase;
  let mockUserRepository: jest.Mocked<IUserRepository>;
  let mockSendVerificationEmail: jest.Mocked<SendVerificationEmailUseCase>;

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

      changePasswordAndClearFlag: jest.fn(),    } as unknown as jest.Mocked<IUserRepository>;

    mockSendVerificationEmail = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<SendVerificationEmailUseCase>;

    useCase = new ResendVerificationUseCase(mockUserRepository, mockSendVerificationEmail);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('sends the email when the user exists and is not verified', async () => {
    mockUserRepository.findByEmail.mockResolvedValue(
      buildUser({ id: 'user-1', email: 'john@example.com', emailVerifiedAt: null })
    );

    await useCase.execute({ email: 'john@example.com' });

    expect(mockSendVerificationEmail.execute).toHaveBeenCalledWith({
      userId: 'user-1',
      email: 'john@example.com',
      name: 'John',
    });
  });

  it('does not send (no-op) when the email does not exist', async () => {
    mockUserRepository.findByEmail.mockResolvedValue(null);

    await useCase.execute({ email: 'unknown@example.com' });

    expect(mockSendVerificationEmail.execute).not.toHaveBeenCalled();
  });

  it('does not send (no-op) when the user is already verified', async () => {
    mockUserRepository.findByEmail.mockResolvedValue(
      buildUser({ emailVerifiedAt: new Date() })
    );

    await useCase.execute({ email: 'john@example.com' });

    expect(mockSendVerificationEmail.execute).not.toHaveBeenCalled();
  });
});
