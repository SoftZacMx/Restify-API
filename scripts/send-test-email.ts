#!/usr/bin/env ts-node

/**
 * Envía un correo de prueba usando el EmailService real del proyecto (4.1.D).
 *
 * Contra LocalStack: el correo NO se entrega de verdad, queda registrado en el
 * mock de SES. Tras correrlo, consultá lo enviado con:
 *   aws --endpoint-url=http://localhost:4566 --region us-east-1 ses get-send-statistics
 *   curl -s http://localhost:4566/_aws/ses | jq
 *
 * Requisitos: LocalStack con `ses` habilitado, identidad EMAIL_FROM verificada,
 * y EMAIL_ENABLED=true en el entorno.
 *
 * Uso:  npx ts-node scripts/send-test-email.ts [destinatario]
 */

import 'dotenv/config';
import 'reflect-metadata';
import { EmailService } from '../src/core/infrastructure/messaging/email.service';

async function main(): Promise<void> {
  const to = process.argv[2] || process.env.EMAIL_FROM || 'test@restify.app';

  console.log('Config:');
  console.log('  EMAIL_ENABLED   =', process.env.EMAIL_ENABLED);
  console.log('  EMAIL_FROM      =', process.env.EMAIL_FROM);
  console.log('  AWS_ENDPOINT_URL=', process.env.AWS_ENDPOINT_URL);
  console.log('  AWS_REGION      =', process.env.AWS_REGION);
  console.log('  to              =', to);
  console.log('');

  const emailService = new EmailService();
  await emailService.send({
    to,
    subject: 'Correo de prueba — Restify (4.1.D)',
    html: '<h1>Funciona ✅</h1><p>Este correo de prueba salió desde el EmailService vía SES/LocalStack.</p>',
  });

  console.log('\n✔ send() completó sin errores.');
}

main().catch((err) => {
  console.error('✘ Error enviando el correo de prueba:', err);
  process.exit(1);
});
