import { Router, Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { closeOrganizationController } from '../../controllers/organization';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import {
  closeOrganizationSchema,
  requestReactivationSchema,
  reactivateOrganizationSchema,
} from '../../core/application/dto/organization.dto';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { TenantMiddleware } from '../middleware/tenant.middleware';
import { authRateLimiter } from '../middleware/rate-limit.middleware';

const router = Router();

/**
 * Módulo Organization (4.1.G — close / reactivate).
 *
 * Este router se monta ANTES del bloque global de auth+tenant en routes/index.ts,
 * porque `reactivate` es público (la org está cerrada y el JWT viejo ya no sirve).
 * `close` aplica auth + tenant inline.
 */

/**
 * POST /api/organization/close — owner autenticado.
 * Marca la org como cerrada + invalida sesiones. Confirmación por nombre en el body.
 */
router.post(
  '/close',
  AuthMiddleware.authenticate,
  TenantMiddleware.attach,
  zodValidator({ schema: closeOrganizationSchema, source: 'body' }),
  closeOrganizationController
);

/**
 * POST /api/organization/request-reactivation — público.
 * El owner (sin sesión) pide por email el link de reactivación. Respuesta uniforme
 * SIEMPRE (200) para no filtrar si el email existe / es owner / la org está cerrada.
 */
router.post(
  '/request-reactivation',
  authRateLimiter,
  zodValidator({ schema: requestReactivationSchema, source: 'body' }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { RequestOrganizationReactivationUseCase } = await import(
        '../../core/application/use-cases/organization/request-organization-reactivation.use-case'
      );

      const useCase = container.resolve(RequestOrganizationReactivationUseCase);
      await useCase.execute(req.body);

      res.status(200).json({
        success: true,
        data: {
          message: 'Si el correo corresponde a una organización reactivable, enviaremos un enlace.',
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/organization/reactivate — público. Confirma con el token del correo.
 * Setea cookie HttpOnly con el nuevo JWT, igual que /login.
 */
router.post(
  '/reactivate',
  authRateLimiter,
  zodValidator({ schema: reactivateOrganizationSchema, source: 'body' }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { ReactivateOrganizationUseCase } = await import(
        '../../core/application/use-cases/organization/reactivate-organization.use-case'
      );

      const useCase = container.resolve(ReactivateOrganizationUseCase);
      const result = await useCase.execute(req.body);

      const isProduction = process.env.NODE_ENV === 'production';
      res.cookie('token', result.token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000,
        path: '/',
      });

      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
