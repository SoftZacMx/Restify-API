import cron, { ScheduledTask } from 'node-cron';
import { container } from 'tsyringe';
import { CleanupUnverifiedOrgsUseCase } from '../../application/use-cases/organization/cleanup-unverified-orgs.use-case';
import { logger } from '../../../shared/utils/logger';

/**
 * Registrador central de crons (jobs programados) del proceso del API.
 *
 * Diseño:
 * - Los jobs viven en UseCases (testeables); aquí solo se agenda su disparo.
 * - Se ejecutan DENTRO del proceso del API (un solo servidor por ahora).
 * - Guarda de escalado: si en el futuro hay >1 instancia, poner `RUN_CRONS=false`
 *   en todas menos una para evitar ejecuciones duplicadas. Por defecto: habilitado.
 */

const tasks: ScheduledTask[] = [];

function cronsEnabled(): boolean {
  // Por defecto habilitado; explícito `false` lo apaga (instancias secundarias / tests).
  return process.env.RUN_CRONS !== 'false';
}

export function startCronJobs(): void {
  if (!cronsEnabled()) {
    logger.info('[cron] Jobs deshabilitados (RUN_CRONS=false)');
    return;
  }

  // 4.1.F — Limpieza diaria de cuentas sin verificar (4:00 AM, hora del servidor).
  const cleanupSchedule = process.env.CLEANUP_UNVERIFIED_CRON || '0 4 * * *';
  const cleanupTask = cron.schedule(
    cleanupSchedule,
    async () => {
      try {
        const useCase = container.resolve(CleanupUnverifiedOrgsUseCase);
        await useCase.execute();
      } catch (error) {
        logger.error({ err: error }, '[cron] cleanup-unverified: ejecución fallida');
      }
    },
    { timezone: process.env.CRON_TIMEZONE || 'America/Mexico_City' }
  );
  tasks.push(cleanupTask);

  logger.info({ cleanupSchedule }, '[cron] Jobs programados iniciados');
}

/** Detiene todos los crons (graceful shutdown / tests). */
export function stopCronJobs(): void {
  for (const task of tasks) {
    task.stop();
  }
  tasks.length = 0;
}
