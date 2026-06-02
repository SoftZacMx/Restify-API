import { VerifyUserUseCase } from '../../../../src/core/application/use-cases/auth/verify-user.use-case';
import { IUserRepository } from '../../../../src/core/domain/interfaces/user-repository.interface';
import { User } from '../../../../src/core/domain/entities/user.entity';
import { JwtUtil } from '../../../../src/shared/utils/jwt.util';
import { UserRole, UserAccountStatus } from '@prisma/client';
import { AppError } from '../../../../src/shared/errors';

jest.mock('../../../../src/shared/utils/jwt.util');

describe('VerifyUserUseCase', () => {
  let verifyUserUseCase: VerifyUserUseCase;
  let mockUserRepository: jest.Mocked<IUserRepository>;

  beforeEach(() => {
    mockUserRepository = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      reactivate: jest.fn(),
      findAll: jest.fn(),
    };

    verifyUserUseCase = new VerifyUserUseCase(mockUserRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    const validInput = {
      email: 'john@example.com',
    };

    it('should return user data with token when user exists', async () => {
      // Create mock user with all multi-tenant fields required for JWT payload
      const mockUser = new User(
        '123', // id
        'John', // name
        'Doe', // last_name
        null, // second_last_name
        'john@example.com', // email
        'hashed_password', // password
        null, // phone
        true, // status
        UserRole.WAITER, // rol
        'org-123', // organizationId
        UserAccountStatus.ACTIVE, // accountStatus
        0, // tokenVersion
        new Date(), // emailVerifiedAt
        false, // mustChangePassword
        new Date(), // createdAt
        new Date() // updatedAt
      );

      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      (JwtUtil.generateToken as jest.Mock).mockReturnValue('reset_token_here');

      const result = await verifyUserUseCase.execute(validInput);

      expect(result).toHaveProperty('token');
      expect(result.email).toBe('john@example.com');
      expect(result.token).toBe('reset_token_here');

      // Verify JWT payload includes all required multi-tenant fields
      expect(JwtUtil.generateToken).toHaveBeenCalledWith(
        {
          sub: '123',
          email: 'john@example.com',
          rol: UserRole.WAITER,
          org: 'org-123',
          branch: undefined, // Password reset is org-level, no branch required
          tokenVersion: 0,
          emailVerified: true,
          mustChangePassword: false,
        },
        '1h'
      );
    });

    it('should throw error when user not found', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);

      try {
        await verifyUserUseCase.execute(validInput);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('USER_NOT_FOUND');
      }
    });
  });
});

