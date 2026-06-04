import 'reflect-metadata';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { container } from 'tsyringe';
import { CleanupUnverifiedOrgsUseCase } from '../../src/core/application/use-cases/organization/cleanup-unverified-orgs.use-case';
import { PrismaService } from '../../src/core/infrastructure/config/prisma.config';
import { logger } from '../../src/shared/utils/logger';
import '../../src/core/infrastructure/config/dependency-injection';

/**
 * Runner manual del cron 4.1.F. Útil para probar la limpieza sin esperar al schedule
 * (el cron automático vive en `cron-scheduler.ts`, dentro del proceso del API).
 *
 *   npm run cron:cleanup-unverified
 */
async function main() {
  const prismaService = container.resolve(PrismaService);
  await prismaService.connect();

  try {
    const useCase = container.resolve(CleanupUnverifiedOrgsUseCase);
    const result = await useCase.execute();
    logger.info(result, '[cron:manual] cleanup-unverified completado');
  } finally {
    await prismaService.disconnect();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    logger.fatal({ err: error }, '[cron:manual] cleanup-unverified falló');
    process.exit(1);
  });
