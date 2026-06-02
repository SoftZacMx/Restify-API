import { Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { AuthenticatedRequest } from './auth.middleware';
import { IOrganizationRepository } from '../../core/domain/interfaces/organization-repository.interface';
import { runWithTenant } from '../../core/infrastructure/tenant/tenant-context';
import { AppError } from '../../shared/errors';

/**
 * Resolves organization (and optional branch) from JWT or legacy single-org DB.
 * Must run after AuthMiddleware.authenticate.
 */
export class TenantMiddleware {
  static attach(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
    void (async () => {
      try {
        const orgFromJwt = req.user?.org;
        const branchFromJwt = req.user?.branch;

        if (orgFromJwt) {
          runWithTenant({ organizationId: orgFromJwt, branchId: branchFromJwt }, () => next());
          return;
        }

        const orgRepository = container.resolve<IOrganizationRepository>('IOrganizationRepository');
        const org = await orgRepository.findFirstActive();
        if (!org) {
          next(new AppError('ORGANIZATION_NOT_FOUND'));
          return;
        }

        runWithTenant({ organizationId: org.id, branchId: branchFromJwt }, () => next());
      } catch (error) {
        next(error);
      }
    })();
  }
}
