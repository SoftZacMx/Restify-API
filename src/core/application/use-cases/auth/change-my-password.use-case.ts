import { inject, injectable } from 'tsyringe';
import { IUserRepository } from '../../../domain/interfaces/user-repository.interface';
import { BcryptUtil } from '../../../../shared/utils/bcrypt.util';
import { AppError } from '../../../../shared/errors';

export interface ChangeMyPasswordInput {
  password: string;
  // Inyectados por makeController (requireAuth) desde el JWT.
  userId: string;
  role?: string;
}

/**
 * Cambio de la propia contraseña por parte del usuario autenticado.
 *
 * Pensado para el flujo forzado (`mustChangePassword = true`): tras un reset del
 * owner, el empleado define su nueva clave. Guarda la contraseña hasheada y baja el
 * flag para que deje de exigirse el cambio. No pide la contraseña actual (el usuario
 * no la conoce en este caso).
 */
@injectable()
export class ChangeMyPasswordUseCase {
  constructor(
    @inject('IUserRepository') private readonly userRepository: IUserRepository
  ) {}

  async execute(input: ChangeMyPasswordInput): Promise<void> {
    const user = await this.userRepository.findById(input.userId);
    if (!user) {
      throw new AppError('USER_NOT_FOUND');
    }

    const hashedPassword = await BcryptUtil.hash(input.password);
    await this.userRepository.changePasswordAndClearFlag(user.id, hashedPassword);
  }
}
