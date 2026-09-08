import { inject, injectable } from 'tsyringe';
import { IUserRepository } from '../../../domain/interfaces/user-repository.interface';
import { JwtUtil } from '../../../../shared/utils/jwt.util';
import { BcryptUtil } from '../../../../shared/utils/bcrypt.util';
import { ResetPasswordInput } from '../../dto/auth.dto';
import { AppError } from '../../../../shared/errors';
import { withoutTenant } from '../../../infrastructure/tenant/tenant-context';

/**
 * Flujo forgot-password (paso 2) — confirma el restablecimiento de contraseña.
 *
 * Valida el token (firma + expiry + `purpose === 'password_reset'`), hashea la
 * nueva contraseña y la persiste revocando TODAS las sesiones activas (el escenario
 * típico de un reset es una cuenta posiblemente comprometida). El token es de vida
 * corta (5 min); no se persiste ni marca como consumido (stateless), igual que el
 * flujo de verificación de email.
 */
@injectable()
export class ResetPasswordUseCase {
  constructor(
    @inject('IUserRepository') private readonly userRepository: IUserRepository
  ) {}

  async execute(input: ResetPasswordInput): Promise<void> {
    let payload;
    try {
      payload = JwtUtil.verifyPasswordResetToken(input.token);
    } catch {
      // Token inválido, expirado o con purpose incorrecto.
      throw new AppError('INVALID_TOKEN');
    }

    const user = await withoutTenant(() => this.userRepository.findById(payload.sub));

    if (!user || !user.isActive()) {
      throw new AppError('USER_NOT_FOUND');
    }

    const hashedPassword = await BcryptUtil.hash(input.password);
    await withoutTenant(() =>
      this.userRepository.changePasswordAndRevokeSessions(user.id, hashedPassword)
    );
  }
}
