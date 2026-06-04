import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { injectable } from 'tsyringe';
import { logger } from '../../../shared/utils/logger';

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

/**
 * Sub-fase 4.1.D — Servicio de email (base).
 *
 * Capacidad genérica de enviar correos vía AWS SES. NO contiene lógica de negocio
 * (eso es 4.1.E). Apagable con `EMAIL_ENABLED`: cuando está deshabilitado el servicio
 * es un no-op que loggea, lo que permite correr dev/test sin credenciales reales.
 */
@injectable()
export class EmailService {
  private readonly client: SESClient;
  private readonly enabled: boolean;
  private readonly from: string;

  constructor() {
    // Por defecto deshabilitado: requiere opt-in explícito con EMAIL_ENABLED=true.
    this.enabled = process.env.EMAIL_ENABLED === 'true';
    this.from = process.env.EMAIL_FROM || 'no-reply@restify.app';

    const endpoint = process.env.AWS_ENDPOINT_URL;
    const region = process.env.AWS_REGION || 'us-east-1';

    this.client = new SESClient({
      region,
      endpoint: endpoint || undefined, // Endpoint para LocalStack, undefined para AWS real
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
      },
    });
  }

  /**
   * Envía un correo. Si `EMAIL_ENABLED` no es 'true', no envía nada y solo loggea
   * (no-op), devolviendo sin error para no romper los flujos que lo invocan.
   */
  async send({ to, subject, html }: SendEmailParams): Promise<void> {
    if (!this.enabled) {
      logger.info({ to, subject }, '[Email] EMAIL_ENABLED=false → email no enviado (no-op)');
      return;
    }

    try {
      const command = new SendEmailCommand({
        Source: this.from,
        Destination: { ToAddresses: [to] },
        Message: {
          Subject: { Data: subject, Charset: 'UTF-8' },
          Body: { Html: { Data: html, Charset: 'UTF-8' } },
        },
      });

      await this.client.send(command);
      logger.info({ to, subject }, '[Email] Correo enviado vía SES');
    } catch (error) {
      logger.error({ err: error, to, subject }, '[Email] Error enviando correo vía SES');
      throw error;
    }
  }
}
