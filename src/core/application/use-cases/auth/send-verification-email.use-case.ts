import { inject, injectable } from 'tsyringe';
import { JwtUtil } from '../../../../shared/utils/jwt.util';
import { EmailService } from '../../../infrastructure/messaging/email.service';
import { renderEmail, escapeHtml } from '../../../infrastructure/messaging/email-template';
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
    const greeting = input.name ? `Hola ${escapeHtml(input.name)},` : 'Hola,';

    const html = renderEmail({
      label: 'Verificación de correo',
      title: 'Confirma tu correo',
      greeting,
      body: ['Gracias por registrarte en Restify. Confirma tu correo para empezar a usar tu cuenta.'],
      action: { label: 'Verificar mi cuenta', url: verifyUrl },
      footer: 'El enlace caduca en 24 horas. Si no creaste esta cuenta, puedes ignorar este correo.',
    });

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
