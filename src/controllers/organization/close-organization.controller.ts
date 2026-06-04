import { CloseOrganizationUseCase } from '../../core/application/use-cases/organization/close-organization.use-case';
import { makeController } from '../../shared/utils/make-controller';

/**
 * POST /api/organization/close (4.1.G) — owner autenticado.
 * makeController inyecta userId/role desde el JWT (requireAuth).
 */
export const closeOrganizationController = makeController(CloseOrganizationUseCase, {
  mapper: (req) => ({
    confirmationName: req.body.confirmationName,
  }),
  requireAuth: true,
});
