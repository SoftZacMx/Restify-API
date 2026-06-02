import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { IBranchRepository } from '../../core/domain/interfaces/branch-repository.interface';
import { runWithTenant } from '../../core/infrastructure/tenant/tenant-context';
import { AppError } from '../../shared/errors';

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

        const branchRepository = container.resolve<IBranchRepository>('IBranchRepository');
        const branch = await branchRepository.findById(branchId);

        if (!branch || !branch.isActive()) {
          next(new AppError('BRANCH_NOT_FOUND'));
          return;
        }

        runWithTenant(
          { organizationId: branch.organizationId, branchId: branch.id },
          () => next()
        );
      } catch (error) {
        next(error);
      }
    })();
  }
}
