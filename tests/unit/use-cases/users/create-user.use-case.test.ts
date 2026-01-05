import { CreateUserUseCase } from '../../../../src/core/application/use-cases/users/create-user.use-case';
import { IUserRepository } from '../../../../src/core/domain/interfaces/user-repository.interface';
import { User } from '../../../../src/core/domain/entities/user.entity';
import { BcryptUtil } from '../../../../src/shared/utils/bcrypt.util';
import { UserRole } from '@prisma/client';
import { AppError } from '../../../../src/shared/errors';

jest.mock('../../../../src/shared/utils/bcrypt.util');

describe('CreateUserUseCase', () => {
  let createUserUseCase: CreateUserUseCase;
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

    createUserUseCase = new CreateUserUseCase(mockUserRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    const validInput = {
      name: 'John',
      last_name: 'Doe',
      second_last_name: 'Smith',
      email: 'john@example.com',
      password: 'password123',
      phone: '+1234567890',
      status: true,
      rol: UserRole.WAITER,
    };

    it('should create a new user successfully', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);
      (BcryptUtil.hash as jest.Mock).mockResolvedValue('hashed_password');

      const mockCreatedUser = new User(
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

      mockUserRepository.create.mockResolvedValue(mockCreatedUser);

      const result = await createUserUseCase.execute(validInput);

      expect(result).toHaveProperty('id');
      expect(result.email).toBe('john@example.com');
      expect(result.name).toBe('John');
      expect(result.rol).toBe(UserRole.WAITER);
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith('john@example.com');
      expect(BcryptUtil.hash).toHaveBeenCalledWith('password123');
      expect(mockUserRepository.create).toHaveBeenCalled();
    });

    it('should throw error when email already exists', async () => {
      const existingUser = new User(
        '123',
        'Existing',
        'User',
        null,
        'john@example.com',
        'hashed_password',
        null,
        true,
        UserRole.WAITER,
        new Date(),
        new Date()
      );

      mockUserRepository.findByEmail.mockResolvedValue(existingUser);

      try {
        await createUserUseCase.execute(validInput);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('VALIDATION_ERROR');
      }
    });

    it('should hash password before creating user', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);
      (BcryptUtil.hash as jest.Mock).mockResolvedValue('hashed_password');

      const mockCreatedUser = new User(
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

      mockUserRepository.create.mockResolvedValue(mockCreatedUser);

      await createUserUseCase.execute(validInput);

      expect(BcryptUtil.hash).toHaveBeenCalledWith('password123');
      expect(mockUserRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          password: 'hashed_password',
        })
      );
    });

    it('should not return password in result', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);
      (BcryptUtil.hash as jest.Mock).mockResolvedValue('hashed_password');

      const mockCreatedUser = new User(
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

      mockUserRepository.create.mockResolvedValue(mockCreatedUser);

      const result = await createUserUseCase.execute(validInput);

      expect(result).not.toHaveProperty('password');
    });
  });
});

