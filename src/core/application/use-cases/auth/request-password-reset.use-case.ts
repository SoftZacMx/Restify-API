import { inject, injectable } from 'tsyringe';
import { IUserRepository } from '../../../domain/interfaces/user-repository.interface';
import { RequestPasswordResetInput } from '../../dto/auth.dto';
import { JwtUtil } from '../../../../shared/utils/jwt.util';
import { EmailService } from '../../../infrastructure/messaging/email.service';
import { withoutTenant } from '../../../infrastructure/tenant/tenant-context';
import { logger } from '../../../../shared/utils/logger';

/**
 * Flujo forgot-password (paso 1) — genera el token de restablecimiento (JWT
 * stateless con `purpose: 'password_reset'`, 5 min) y envía el correo con el link.
 *
 * No revela si el email existe ni su estado (anti-enumeración): siempre resuelve
 * sin error. Solo despacha el correo cuando el usuario existe y está activo.
 * Reutiliza `EmailService`, apagable por `EMAIL_ENABLED`. No persiste nada.
 */
@injectable()
export class RequestPasswordResetUseCase {
  constructor(
    @inject('IUserRepository') private readonly userRepository: IUserRepository,
    @inject(EmailService) private readonly emailService: EmailService
  ) {}

  async execute(input: RequestPasswordResetInput): Promise<void> {
    const user = await withoutTenant(() => this.userRepository.findByEmail(input.email));

    if (!user || !user.isActive()) {
      return; // No-op silencioso para no filtrar existencia/estado del email.
    }

    const token = JwtUtil.generatePasswordResetToken({
      sub: user.id,
      email: user.email,
    });

    const resetUrl = `${this.appBaseUrl()}/auth/reset-password?token=${encodeURIComponent(token)}`;
    const greeting = user.name ? `Hola ${user.name},` : 'Hola,';

    const html = `
      <p>${greeting}</p>
      <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta de Restify.
         Haz clic en el siguiente botón para elegir una nueva contraseña:</p>
      <p>
        <a href="${resetUrl}"
           style="display:inline-block;padding:12px 20px;background:#111827;color:#fff;text-decoration:none;border-radius:6px;">
          Restablecer contraseña
        </a>
      </p>
      <p>O copia este enlace en tu navegador:<br/><a href="${resetUrl}">${resetUrl}</a></p>
      <p>El enlace caduca en 5 minutos. Si no solicitaste este cambio, puedes ignorar este correo:
         tu contraseña seguirá siendo la misma.</p>
    `.trim();

    // El envío es best-effort: si el correo falla (SES caído, remitente no verificado, etc.)
    // lo registramos pero NO propagamos el error, para mantener la respuesta uniforme 200
    // (anti-enumeración) y no romperle la petición al usuario.
    try {
      await this.emailService.send({
        to: user.email,
        subject: 'Restablece tu contraseña — Restify',
        html,
      });
      logger.info({ userId: user.id }, '[Email] Correo de restablecimiento despachado');
    } catch (error) {
      logger.error(
        { err: error, userId: user.id },
        '[Email] Fallo al enviar correo de restablecimiento (ignorado)'
      );
    }
  }

  /**
   * Base URL del frontend donde vive la pantalla /auth/reset-password.
   * Usa APP_URL si está definida; si no, cae a CORS_ORIGIN (ya configurada).
   */
  private appBaseUrl(): string {
    const base = process.env.APP_URL || process.env.CORS_ORIGIN || 'http://localhost:5173';
    return base.replace(/\/+$/, '');
  }
}
