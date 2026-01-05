import { VerifyUserUseCase } from '../../../../src/core/application/use-cases/auth/verify-user.use-case';
import { IUserRepository } from '../../../../src/core/domain/interfaces/user-repository.interface';
import { User } from '../../../../src/core/domain/entities/user.entity';
import { JwtUtil } from '../../../../src/shared/utils/jwt.util';
import { UserRole } from '@prisma/client';
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
      const mockUser = new User(
        '123',
        'John',
        'Doe',
        null,
        'john@example.com',
        'hashed_password',
        null,
        true,
        UserRole.WAITER,
        new Date(),
        new Date()
      );

      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      (JwtUtil.generateToken as jest.Mock).mockReturnValue('reset_token_here');

      const result = await verifyUserUseCase.execute(validInput);

      expect(result).toHaveProperty('token');
      expect(result.email).toBe('john@example.com');
      expect(result.token).toBe('reset_token_here');
      expect(JwtUtil.generateToken).toHaveBeenCalledWith(
        { email: 'john@example.com', userId: '123' },
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

