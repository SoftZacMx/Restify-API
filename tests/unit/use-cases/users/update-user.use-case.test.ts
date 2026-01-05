import { UpdateUserUseCase } from '../../../../src/core/application/use-cases/users/update-user.use-case';
import { IUserRepository } from '../../../../src/core/domain/interfaces/user-repository.interface';
import { User } from '../../../../src/core/domain/entities/user.entity';
import { BcryptUtil } from '../../../../src/shared/utils/bcrypt.util';
import { UserRole } from '@prisma/client';
import { AppError } from '../../../../src/shared/errors';

jest.mock('../../../../src/shared/utils/bcrypt.util');

describe('UpdateUserUseCase', () => {
  let updateUserUseCase: UpdateUserUseCase;
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

    updateUserUseCase = new UpdateUserUseCase(mockUserRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    const userId = '123';
    const existingUser = new User(
      '123',
      'John',
      'Doe',
      null,
      'john@example.com',
      'old_hash',
      null,
      true,
      UserRole.WAITER,
      new Date(),
      new Date()
    );

    it('should update user successfully', async () => {
      mockUserRepository.findById.mockResolvedValue(existingUser);
      mockUserRepository.update.mockResolvedValue({
        ...existingUser,
        name: 'Jane',
      } as User);

      const result = await updateUserUseCase.execute(userId, { name: 'Jane' });

      expect(result.name).toBe('Jane');
      expect(mockUserRepository.findById).toHaveBeenCalledWith(userId);
      expect(mockUserRepository.update).toHaveBeenCalled();
    });

    it('should throw error when user not found', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      try {
        await updateUserUseCase.execute(userId, { name: 'Jane' });
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('USER_NOT_FOUND');
      }
    });

    it('should hash password when password is provided', async () => {
      mockUserRepository.findById.mockResolvedValue(existingUser);
      (BcryptUtil.hash as jest.Mock).mockResolvedValue('new_hashed_password');
      mockUserRepository.update.mockResolvedValue(existingUser);

      await updateUserUseCase.execute(userId, { password: 'newPassword123' });

      expect(BcryptUtil.hash).toHaveBeenCalledWith('newPassword123');
      expect(mockUserRepository.update).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          password: 'new_hashed_password',
        })
      );
    });

    it('should throw error when new email already exists', async () => {
      const otherUser = new User(
        '456',
        'Other',
        'User',
        null,
        'other@example.com',
        'hash',
        null,
        true,
        UserRole.WAITER,
        new Date(),
        new Date()
      );

      mockUserRepository.findById.mockResolvedValue(existingUser);
      mockUserRepository.findByEmail.mockResolvedValue(otherUser);

      try {
        await updateUserUseCase.execute(userId, { email: 'other@example.com' });
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('VALIDATION_ERROR');
      }
    });

    it('should allow updating to same email', async () => {
      mockUserRepository.findById.mockResolvedValue(existingUser);
      mockUserRepository.update.mockResolvedValue(existingUser);

      await updateUserUseCase.execute(userId, { email: 'john@example.com' });

      expect(mockUserRepository.findByEmail).not.toHaveBeenCalled();
      expect(mockUserRepository.update).toHaveBeenCalled();
    });

    it('should not return password in result', async () => {
      mockUserRepository.findById.mockResolvedValue(existingUser);
      mockUserRepository.update.mockResolvedValue(existingUser);

      const result = await updateUserUseCase.execute(userId, { name: 'Jane' });

      expect(result).not.toHaveProperty('password');
    });
  });
});

