import { ReactivateUserUseCase } from '../../../../src/core/application/use-cases/users/reactivate-user.use-case';
import { IUserRepository } from '../../../../src/core/domain/interfaces/user-repository.interface';
import { User } from '../../../../src/core/domain/entities/user.entity';
import { UserRole, UserAccountStatus } from '@prisma/client';

function makeUser(status: boolean): User {
  return new User(
    'user-1',
    'Juan',
    'Perez',
    null,
    'juan@example.com',
    'hashed',
    null,
    status,
    UserRole.WAITER,
    'org-1',
    UserAccountStatus.ACTIVE,
    0,
    null,
    false,
    new Date(),
    new Date()
  );
}

describe('ReactivateUserUseCase', () => {
  let useCase: ReactivateUserUseCase;
  let userRepository: jest.Mocked<IUserRepository>;

  beforeEach(() => {
    userRepository = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      reactivate: jest.fn(),
      markForPasswordReset: jest.fn(),
      markEmailVerified: jest.fn(),
      changePasswordAndClearFlag: jest.fn(),      changePasswordAndRevokeSessions: jest.fn(),
      findAll: jest.fn(),
    } as unknown as jest.Mocked<IUserRepository>;

    useCase = new ReactivateUserUseCase(userRepository);
  });

  it('reactiva un usuario inactivo', async () => {
    userRepository.findById.mockResolvedValue(makeUser(false));

    await useCase.execute({ user_id: 'user-1' });

    expect(userRepository.reactivate).toHaveBeenCalledWith('user-1');
  });

  it('lanza USER_NOT_FOUND si el usuario no existe', async () => {
    userRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute({ user_id: 'user-1' })).rejects.toMatchObject({
      code: 'USER_NOT_FOUND',
    });
    expect(userRepository.reactivate).not.toHaveBeenCalled();
  });

  it('lanza USER_ALREADY_ACTIVE si el usuario ya está activo', async () => {
    userRepository.findById.mockResolvedValue(makeUser(true));

    await expect(useCase.execute({ user_id: 'user-1' })).rejects.toMatchObject({
      code: 'USER_ALREADY_ACTIVE',
    });
    expect(userRepository.reactivate).not.toHaveBeenCalled();
  });
});
