import { SetPasswordUseCase } from '../../../../src/core/application/use-cases/auth/set-password.use-case';
import { IUserRepository } from '../../../../src/core/domain/interfaces/user-repository.interface';
import { User } from '../../../../src/core/domain/entities/user.entity';
import { BcryptUtil } from '../../../../src/shared/utils/bcrypt.util';
import { UserRole } from '@prisma/client';
import { AppError } from '../../../../src/shared/errors';

jest.mock('../../../../src/shared/utils/bcrypt.util');

describe('SetPasswordUseCase', () => {
  let setPasswordUseCase: SetPasswordUseCase;
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

    setPasswordUseCase = new SetPasswordUseCase(mockUserRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    const validInput = {
      password: 'newPassword123',
      user_id: '123',
    };

    it('should update password when user exists', async () => {
      const mockUser = new User(
        '123',
        'John',
        'Doe',
        null,
        'john@example.com',
        'old_hashed_password',
        null,
        true,
        UserRole.WAITER,
        new Date(),
        new Date()
      );

      mockUserRepository.findById.mockResolvedValue(mockUser);
      (BcryptUtil.hash as jest.Mock).mockResolvedValue('new_hashed_password');
      mockUserRepository.update.mockResolvedValue(mockUser);

      await setPasswordUseCase.execute(validInput);

      expect(mockUserRepository.findById).toHaveBeenCalledWith('123');
      expect(BcryptUtil.hash).toHaveBeenCalledWith('newPassword123');
      expect(mockUserRepository.update).toHaveBeenCalledWith('123', expect.any(Object));
    });

    it('should throw error when user not found', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      try {
        await setPasswordUseCase.execute(validInput);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('USER_NOT_FOUND');
      }
    });
  });
});

