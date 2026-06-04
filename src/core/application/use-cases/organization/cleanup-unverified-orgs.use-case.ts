import { inject, injectable } from 'tsyringe';
import { IOrganizationRepository } from '../../../domain/interfaces/organization-repository.interface';
import { withoutTenant } from '../../../infrastructure/tenant/tenant-context';
import { logger } from '../../../../shared/utils/logger';

/** Días por defecto antes de cerrar una cuenta cuyo owner nunca verificó email. */
const DEFAULT_UNVERIFIED_RETENTION_DAYS = 7;

export interface CleanupUnverifiedOrgsResult {
  thresholdDays: number;
  found: number;
  closed: number;
  failed: number;
}

/**
 * Sub-fase 4.1.F — Limpieza de cuentas fantasma.
 *
 * Cierra (soft-close, igual que 4.1.G) las organizaciones cuyo OWNER nunca verificó
 * su email tras `UNVERIFIED_RETENTION_DAYS` días (7 por defecto). El hard-delete real
 * lo hace el cron de 30 días (Transversal C.3) sobre las orgs ya cerradas.
 *
 * Es cross-tenant: corre dentro de `withoutTenant` (no hay un tenant fijo).
 * El soft-close reutiliza `OrganizationRepository.close`, que además invalida las
 * sesiones de los usuarios de la org (incrementa su tokenVersion).
 */
@injectable()
export class CleanupUnverifiedOrgsUseCase {
  constructor(
    @inject('IOrganizationRepository')
    private readonly organizationRepository: IOrganizationRepository
  ) {}

  async execute(now: Date = new Date()): Promise<CleanupUnverifiedOrgsResult> {
    const thresholdDays = this.getRetentionDays();
    const threshold = new Date(now.getTime() - thresholdDays * 24 * 60 * 60 * 1000);

    return withoutTenant(async () => {
      const orgIds =
        await this.organizationRepository.findUnverifiedOwnerOrgIdsOlderThan(threshold);

      let closed = 0;
      let failed = 0;

      for (const id of orgIds) {
        try {
          await this.organizationRepository.close(id);
          closed++;
        } catch (error) {
          // No abortamos el lote por una org: registramos y seguimos.
          failed++;
          logger.error({ err: error, organizationId: id }, '[cron] cleanup-unverified: fallo al cerrar org');
        }
      }

      const result: CleanupUnverifiedOrgsResult = {
        thresholdDays,
        found: orgIds.length,
        closed,
        failed,
      };

      // Log explícito del resultado (sin truncado silencioso — requisito del plan).
      logger.info(result, '[cron] cleanup-unverified: cuentas sin verificar procesadas');

      return result;
    });
  }

  private getRetentionDays(): number {
    const raw = process.env.UNVERIFIED_RETENTION_DAYS;
    const parsed = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_UNVERIFIED_RETENTION_DAYS;
  }
}
