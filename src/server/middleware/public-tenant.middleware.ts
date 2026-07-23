import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { runWithTenant } from '../../core/infrastructure/tenant/tenant-context';
import { AppError } from '../../shared/errors';
import { TenantResolverService } from '../../core/application/services/tenant-resolver.service';
/**
 * Middleware for public routes that need tenant context.
 * Extracts branchId from query param or request body and establishes tenant context.
 */
export class PublicTenantMiddleware {
  static fromBranch(req: Request, res: Response, next: NextFunction): void {
    void (async () => {
      try {
        const branchId = (req.query.branchId as string) || req.body?.branchId;

        if (!branchId) {
          next(new AppError('VALIDATION_ERROR', 'branchId is required'));
          return;
        }

        const tenantResolver = container.resolve(TenantResolverService);
        // Rutas públicas: el branch debe estar activo para poder operar.
        const resolution = await tenantResolver.resolve(branchId, { requireActiveBranch: true });

        if (!resolution.ok) {
          next(
            new AppError(
              resolution.reason === 'ORGANIZATION_INACTIVE'
                ? 'ORGANIZATION_INACTIVE'
                : 'BRANCH_NOT_FOUND'
            )
          );
          return;
        }

        runWithTenant(resolution.tenant, () => next());
      } catch (error) {
        next(error);
      }
    })();
  }
}
