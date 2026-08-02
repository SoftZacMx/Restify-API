import { ChangeMyPasswordUseCase } from '../../../../src/core/application/use-cases/auth/change-my-password.use-case';
import { IUserRepository } from '../../../../src/core/domain/interfaces/user-repository.interface';
import { User } from '../../../../src/core/domain/entities/user.entity';
import { BcryptUtil } from '../../../../src/shared/utils/bcrypt.util';
import { UserRole, UserAccountStatus } from '@prisma/client';

jest.mock('../../../../src/shared/utils/bcrypt.util');

function makeUser(): User {
  return new User(
    'user-1',
    'Juan',
    'Perez',
    null,
    'juan@example.com',
    'hashed',
    null,
    true,
    UserRole.OWNER,
    'org-1',
    UserAccountStatus.ACTIVE,
    0,
    null,
    true,
    new Date(),
    new Date()
  );
}

describe('ChangeMyPasswordUseCase', () => {
  let useCase: ChangeMyPasswordUseCase;
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

    useCase = new ChangeMyPasswordUseCase(userRepository);
    (BcryptUtil.hash as jest.Mock).mockResolvedValue('hashed-nueva');
  });

  it('hashea la contraseña y limpia el flag mustChangePassword', async () => {
    userRepository.findById.mockResolvedValue(makeUser());

    await useCase.execute({ password: 'NuevaPass1', userId: 'user-1' });

    expect(BcryptUtil.hash).toHaveBeenCalledWith('NuevaPass1');
    expect(userRepository.changePasswordAndClearFlag).toHaveBeenCalledWith('user-1', 'hashed-nueva');
  });

  it('lanza USER_NOT_FOUND si el usuario no existe', async () => {
    userRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute({ password: 'NuevaPass1', userId: 'user-1' })).rejects.toMatchObject({
      code: 'USER_NOT_FOUND',
    });
    expect(userRepository.changePasswordAndClearFlag).not.toHaveBeenCalled();
  });
});
