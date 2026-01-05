import { GetUserUseCase } from '../../../../src/core/application/use-cases/users/get-user.use-case';
import { IUserRepository } from '../../../../src/core/domain/interfaces/user-repository.interface';
import { User } from '../../../../src/core/domain/entities/user.entity';
import { UserRole } from '@prisma/client';
import { AppError } from '../../../../src/shared/errors';

describe('GetUserUseCase', () => {
  let getUserUseCase: GetUserUseCase;
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

    getUserUseCase = new GetUserUseCase(mockUserRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    const validInput = {
      user_id: '123',
    };

    it('should return user data when user exists', async () => {
      const mockUser = new User(
        '123',
        'John',
        'Doe',
        'Smith',
        'john@example.com',
        'hashed_password',
        '+1234567890',
        true,
        UserRole.WAITER,
        new Date(),
        new Date()
      );

      mockUserRepository.findById.mockResolvedValue(mockUser);

      const result = await getUserUseCase.execute(validInput);

      expect(result).toHaveProperty('id');
      expect(result.id).toBe('123');
      expect(result.email).toBe('john@example.com');
      expect(result.name).toBe('John');
      expect(result).not.toHaveProperty('password');
      expect(mockUserRepository.findById).toHaveBeenCalledWith('123');
    });

    it('should throw error when user not found', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      try {
        await getUserUseCase.execute(validInput);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('USER_NOT_FOUND');
      }
    });

    it('should not return password in result', async () => {
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

      mockUserRepository.findById.mockResolvedValue(mockUser);

      const result = await getUserUseCase.execute(validInput);

      expect(result).not.toHaveProperty('password');
    });
  });
});

