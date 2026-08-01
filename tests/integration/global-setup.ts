import { PrismaClient } from '@prisma/client';
import { INTEGRATION_TEST_DATABASE_URL, isLocalTestDatabase } from './utils';

/**
 * Se ejecuta UNA vez antes de toda la suite de integración (jest globalSetup).
 *
 * Garantiza que la BD de pruebas empiece vacía y que NUNCA se toque la BD de
 * desarrollo o la QA remota: si DATABASE_URL no apunta a una BD local `_test`,
 * aborta el run por completo.
 */
export default async function globalSetup(): Promise<void> {
  const url = process.env.DATABASE_URL;

  if (!isLocalTestDatabase(url)) {
    throw new Error(
      `Los tests de integración requieren DATABASE_URL a una BD local de pruebas ` +
        `(ej: ${INTEGRATION_TEST_DATABASE_URL}). Obtenido: "${url ?? 'undefined'}". ` +
        `Usa "npm run test:integration".`
    );
  }

  const prisma = new PrismaClient();
  try {
    const tables = await prisma.$queryRaw<Array<{ TABLE_NAME: string }>>`
      SELECT TABLE_NAME FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME <> '_prisma_migrations'
    `;

    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0');
    for (const { TABLE_NAME } of tables) {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE \`${TABLE_NAME}\``);
    }
    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1');
  } finally {
    await prisma.$disconnect();
  }
}
