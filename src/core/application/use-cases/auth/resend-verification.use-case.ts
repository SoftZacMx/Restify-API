import { inject, injectable } from 'tsyringe';
import { IUserRepository } from '../../../domain/interfaces/user-repository.interface';
import { ResendVerificationInput } from '../../dto/auth.dto';
import { SendVerificationEmailUseCase } from './send-verification-email.use-case';

/**
 * Sub-fase 4.1.E — Reenvía el correo de verificación.
 *
 * No revela si el email existe ni su estado (anti-enumeración): siempre resuelve
 * sin error. Solo despacha el correo cuando el usuario existe y aún no verificó.
 * El token anterior sigue siendo válido hasta expirar; es inofensivo porque el
 * efecto es idempotente (ver VerifyEmailUseCase).
 */
@injectable()
export class ResendVerificationUseCase {
  constructor(
    @inject('IUserRepository') private readonly userRepository: IUserRepository,
    @inject(SendVerificationEmailUseCase)
    private readonly sendVerificationEmail: SendVerificationEmailUseCase
  ) {}

  async execute(input: ResendVerificationInput): Promise<void> {
    const user = await this.userRepository.findByEmail(input.email);

    if (!user || user.isEmailVerified()) {
      return; // No-op silencioso para no filtrar existencia/estado del email.
    }

    await this.sendVerificationEmail.execute({
      userId: user.id,
      email: user.email,
      name: user.name,
    });
  }
}
