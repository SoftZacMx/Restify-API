import { inject, injectable } from 'tsyringe';
import { IUserRepository } from '../../../domain/interfaces/user-repository.interface';
import { JwtUtil } from '../../../../shared/utils/jwt.util';
import { VerifyEmailInput } from '../../dto/auth.dto';
import { AppError } from '../../../../shared/errors';

export interface VerifyEmailResult {
  email: string;
  alreadyVerified: boolean;
}

/**
 * Sub-fase 4.1.E — Confirma la titularidad del correo.
 *
 * Valida el token (firma + expiry + `purpose === 'email_verification'`) y, si el
 * usuario no estaba verificado, setea `emailVerifiedAt = now()`. Es idempotente:
 * un segundo uso del token (o un token regenerado por resend) responde
 * `alreadyVerified: true` sin error — no se marca el token como "consumido".
 */
@injectable()
export class VerifyEmailUseCase {
  constructor(
    @inject('IUserRepository') private readonly userRepository: IUserRepository
  ) {}

  async execute(input: VerifyEmailInput): Promise<VerifyEmailResult> {
    let payload;
    try {
      payload = JwtUtil.verifyEmailVerificationToken(input.token);
    } catch {
      // Token inválido, expirado o con purpose incorrecto.
      throw new AppError('INVALID_TOKEN');
    }

    const user = await this.userRepository.findById(payload.sub);

    if (!user) {
      throw new AppError('USER_NOT_FOUND');
    }

    if (user.isEmailVerified()) {
      return { email: user.email, alreadyVerified: true };
    }

    await this.userRepository.markEmailVerified(user.id);

    return { email: user.email, alreadyVerified: false };
  }
}
