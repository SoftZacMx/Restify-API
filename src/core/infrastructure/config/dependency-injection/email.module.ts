import { container } from 'tsyringe';
import { EmailService } from '../../messaging/email.service';

// Servicio de email base (4.1.D). Singleton: un único cliente SES en toda la app.
container.registerSingleton(EmailService);
