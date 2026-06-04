import { inject, injectable } from 'tsyringe';
import { JwtUtil } from '../../../../shared/utils/jwt.util';
import { EmailService } from '../../../infrastructure/messaging/email.service';
import { logger } from '../../../../shared/utils/logger';

export interface SendVerificationEmailInput {
  userId: string;
  email: string;
  name?: string;
}

/**
 * Sub-fase 4.1.E — Genera el token de verificación (JWT stateless con
 * `purpose: 'email_verification'`, 24h) y envía el correo con el link.
 *
 * Reutiliza `EmailService` (4.1.D), apagable por `EMAIL_ENABLED`. No persiste
 * nada: el estado "verificado/no verificado" vive en `User.emailVerifiedAt`.
 */
@injectable()
export class SendVerificationEmailUseCase {
  constructor(
    @inject(EmailService) private readonly emailService: EmailService
  ) {}

  async execute(input: SendVerificationEmailInput): Promise<void> {
    const token = JwtUtil.generateEmailVerificationToken({
      sub: input.userId,
      email: input.email,
    });

    const verifyUrl = `${this.appBaseUrl()}/verify-email?token=${encodeURIComponent(token)}`;
    const greeting = input.name ? `Hola ${input.name},` : 'Hola,';

    const html = `
      <p>${greeting}</p>
      <p>Gracias por registrarte en Restify. Confirma tu correo haciendo clic en el siguiente botón:</p>
      <p>
        <a href="${verifyUrl}"
           style="display:inline-block;padding:12px 20px;background:#111827;color:#fff;text-decoration:none;border-radius:6px;">
          Verificar mi cuenta
        </a>
      </p>
      <p>O copia este enlace en tu navegador:<br/><a href="${verifyUrl}">${verifyUrl}</a></p>
      <p>El enlace caduca en 24 horas. Si no creaste esta cuenta, puedes ignorar este correo.</p>
    `.trim();

    await this.emailService.send({
      to: input.email,
      subject: 'Confirma tu correo — Restify',
      html,
    });

    logger.info({ userId: input.userId }, '[Email] Correo de verificación despachado');
  }

  /**
   * Base URL del frontend donde vive la pantalla /verify-email.
   * Usa APP_URL si está definida; si no, cae a CORS_ORIGIN (ya configurada).
   */
  private appBaseUrl(): string {
    const base = process.env.APP_URL || process.env.CORS_ORIGIN || 'http://localhost:5173';
    return base.replace(/\/+$/, '');
  }
}
