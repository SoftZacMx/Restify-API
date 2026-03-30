import { LoginUseCase } from '../../../../src/core/application/use-cases/auth/login.use-case';
import { IUserRepository } from '../../../../src/core/domain/interfaces/user-repository.interface';
import { User } from '../../../../src/core/domain/entities/user.entity';
import { BcryptUtil } from '../../../../src/shared/utils/bcrypt.util';
import { JwtUtil } from '../../../../src/shared/utils/jwt.util';
import { UserRole } from '@prisma/client';
import { AppError } from '../../../../src/shared/errors';

// Mock dependencies
jest.mock('../../../../src/shared/utils/bcrypt.util');
jest.mock('../../../../src/shared/utils/jwt.util');

describe('LoginUseCase', () => {
  let loginUseCase: LoginUseCase;
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

    loginUseCase = new LoginUseCase(mockUserRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    const validInput = {
      email: 'john@example.com',
      password: 'password123',
    };

    it('should return token and user data on successful login', async () => {
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
      (BcryptUtil.compare as jest.Mock).mockResolvedValue(true);
      (JwtUtil.generateToken as jest.Mock).mockReturnValue('jwt_token_here');

      const result = await loginUseCase.execute(validInput);

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('user');
      expect(result.token).toBe('jwt_token_here');
      expect(result.user.id).toBe('123');
      expect(result.user.name).toBe('John');
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith('john@example.com');
      expect(BcryptUtil.compare).toHaveBeenCalledWith('password123', 'hashed_password');
    });

    it('should throw error when user not found', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);

      try {
        await loginUseCase.execute(validInput);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('USER_NOT_FOUND');
      }
    });

    it('should throw error when user is not active', async () => {
      const inactiveUser = new User(
        '123',
        'John',
        'Doe',
        null,
        'john@example.com',
        'hashed_password',
        null,
        false, // inactive
        UserRole.WAITER,
        new Date(),
        new Date()
      );

      mockUserRepository.findByEmail.mockResolvedValue(inactiveUser);

      try {
        await loginUseCase.execute(validInput);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('USER_NOT_ACTIVE');
      }
    });

    it('should throw error when password is incorrect', async () => {
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
      (BcryptUtil.compare as jest.Mock).mockResolvedValue(false);

      try {
        await loginUseCase.execute(validInput);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('PASSWORD_INCORRECT');
      }
    });
  });
});

