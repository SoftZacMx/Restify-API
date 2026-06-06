import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';
import { runWithTenant } from '../../core/infrastructure/tenant/tenant-context';
import { AppError } from '../../shared/errors';

/**
 * Resolves organization (and optional branch) from the JWT and sets the tenant context.
 * Must run after AuthMiddleware.authenticate.
 *
 * Fail-secure: a valid token without `org` is rejected, never resolved to a default org.
 */
export class TenantMiddleware {
  static attach(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
    const organizationId = req.user?.org;
    const branchId = req.user?.branch;

    if (!organizationId) {
      next(new AppError('ORGANIZATION_NOT_FOUND'));
      return;
    }

    runWithTenant({ organizationId, branchId }, () => next());
  }
}
