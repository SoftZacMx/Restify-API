import { inject, injectable } from 'tsyringe';
import { IUserRepository } from '../../../domain/interfaces/user-repository.interface';
import { IOrganizationRepository } from '../../../domain/interfaces/organization-repository.interface';
import { RequestReactivationInput } from '../../dto/organization.dto';
import { JwtUtil } from '../../../../shared/utils/jwt.util';
import { EmailService } from '../../../infrastructure/messaging/email.service';
import { logger } from '../../../../shared/utils/logger';

/** Ventana (días) durante la cual el owner puede reactivar antes del hard-delete (C.3). */
const REACTIVATION_WINDOW_DAYS = 30;

/**
 * Sub-fase 4.1.G — Solicitud de reactivación de organización (owner, ruta pública).
 *
 * El owner no tiene sesión (la org está cerrada y su JWT quedó invalidado), así que
 * este endpoint es la puerta de entrada: recibe solo el email y, si corresponde a un
 * owner de una org cerrada dentro de la ventana de 30 días, envía por correo un link
 * con un token firmado (`purpose: 'organization_reactivation'`, 10 min).
 *
 * La verificación de identidad es FUERA DE BANDA: se prueba con el control del buzón,
 * no con contraseña (que el owner puede haber olvidado tras semanas sin entrar).
 *
 * Respuesta uniforme SIEMPRE (anti-enumeración): no revela si el email existe, si es
 * owner, ni el estado de la org. El controller responde 200 pase lo que pase aquí.
 */
@injectable()
export class RequestOrganizationReactivationUseCase {
  constructor(
    @inject('IUserRepository') private readonly userRepository: IUserRepository,
    @inject('IOrganizationRepository')
    private readonly organizationRepository: IOrganizationRepository,
    @inject(EmailService) private readonly emailService: EmailService
  ) {}

  async execute(input: RequestReactivationInput): Promise<void> {
    const { email } = input;

    // Cualquier condición que no aplique termina en silencio: no se envía correo,
    // pero el controller responde igual (anti-enumeración).
    const user = await this.userRepository.findByEmail(email);
    if (!user || !user.isOwner()) {
      logger.info({ email }, '[Reactivation] Solicitud ignorada (no owner o inexistente)');
      return;
    }

    const org = await this.organizationRepository.findByIdIncludingDeleted(user.organizationId);
    if (!org || org.deletedAt === null) {
      logger.info(
        { organizationId: user.organizationId },
        '[Reactivation] Solicitud ignorada (org inexistente o no cerrada)'
      );
      return;
    }

    // Fuera de la ventana → el cron ya pudo hard-deletearla; no tiene sentido el link.
    const deadline = new Date(
      org.deletedAt.getTime() + REACTIVATION_WINDOW_DAYS * 24 * 60 * 60 * 1000
    );
    if (new Date() > deadline) {
      logger.info(
        { organizationId: org.id },
        '[Reactivation] Solicitud ignorada (ventana vencida)'
      );
      return;
    }

    const token = JwtUtil.generateOrganizationReactivationToken({
      sub: user.id,
      email: user.email,
      org: org.id,
    });

    const reactivateUrl = `${this.appBaseUrl()}/reactivate-organization?token=${encodeURIComponent(token)}`;

    const html = `
      <p>Hola,</p>
      <p>Recibimos una solicitud para reactivar tu organización <strong>${org.name}</strong> en Restify.</p>
      <p>Haz clic en el siguiente botón para reactivarla y volver a entrar:</p>
      <p>
        <a href="${reactivateUrl}"
           style="display:inline-block;padding:12px 20px;background:#111827;color:#fff;text-decoration:none;border-radius:6px;">
          Reactivar mi organización
        </a>
      </p>
      <p>O copia este enlace en tu navegador:<br/><a href="${reactivateUrl}">${reactivateUrl}</a></p>
      <p>El enlace caduca en 10 minutos. Si no solicitaste esto, puedes ignorar este correo.</p>
    `.trim();

    // Best-effort: si el correo falla (SES caído, remitente no verificado, etc.) lo
    // registramos pero NO propagamos el error, para mantener la respuesta uniforme 200
    // (anti-enumeración) y no romperle la petición al owner.
    try {
      await this.emailService.send({
        to: user.email,
        subject: 'Reactiva tu organización — Restify',
        html,
      });
      logger.info({ organizationId: org.id }, '[Reactivation] Correo de reactivación despachado');
    } catch (error) {
      logger.error(
        { err: error, organizationId: org.id },
        '[Reactivation] Fallo al enviar correo de reactivación (ignorado)'
      );
    }
  }

  /**
   * Base URL del frontend donde vive la pantalla /reactivate-organization.
   * Usa APP_URL si está definida; si no, cae a CORS_ORIGIN (ya configurada).
   */
  private appBaseUrl(): string {
    const base = process.env.APP_URL || process.env.CORS_ORIGIN || 'http://localhost:5173';
    return base.replace(/\/+$/, '');
  }
}
