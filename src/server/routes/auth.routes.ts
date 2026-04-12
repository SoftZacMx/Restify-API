import { Router, Request, Response, NextFunction } from 'express';
import { verifyUserController } from '../../controllers/auth/verify-user.controller';
import { setPasswordController } from '../../controllers/auth/set-password.controller';
import { logoutController } from '../../controllers/auth/logout.controller';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { loginSchema, verifyUserSchema } from '../../core/application/dto/auth.dto';
import { authRateLimiter, passwordResetRateLimiter } from '../middleware/rate-limit.middleware';
import { AuthMiddleware, AuthenticatedRequest } from '../middleware/auth.middleware';

const router = Router();

/**
 * POST /api/auth/login/:rol
 * Login endpoint
 * Protected with rate limiting: 5 attempts per 15 minutes
 * Sets HttpOnly cookie with JWT token for secure authentication
 */
router.post(
  '/login/:rol',
  authRateLimiter,
  zodValidator({ schema: loginSchema, source: 'body' }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { container } = await import('tsyringe');
      const { LoginUseCase } = await import('../../core/application/use-cases/auth/login.use-case');

      const loginUseCase = container.resolve(LoginUseCase);
      const result = await loginUseCase.execute(req.body, req.params.rol);

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

/**
 * POST /api/auth/verify-user
 * Verify user endpoint
 * Protected with rate limiting: 3 attempts per 15 minutes (prevents email enumeration)
 */
router.post(
  '/verify-user',
  passwordResetRateLimiter,
  zodValidator({ schema: verifyUserSchema, source: 'body' }),
  verifyUserController
);

/**
 * POST /api/auth/set-password/:user_id
 * Set password endpoint
 * Protected with authentication: only the own user or ADMIN/MANAGER can set passwords
 * Protected with rate limiting: 3 attempts per 15 minutes
 */
router.post(
  '/set-password/:user_id',
  passwordResetRateLimiter,
  AuthMiddleware.authenticate,
  (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { user_id } = req.params;
    const isOwnUser = req.user?.userId === user_id;
    const isAdminOrManager = req.user?.rol === 'ADMIN' || req.user?.rol === 'MANAGER';

    if (!isOwnUser && !isAdminOrManager) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'No tienes permisos para cambiar esta contraseña',
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }
    next();
  },
  setPasswordController
);

/**
 * POST /api/auth/recover-password/:user_id
 * Reset password endpoint (público — flujo de recuperación sin sesión)
 * El frontend primero verifica el email con /verify-user, obtiene el user_id,
 * y luego llama a este endpoint para cambiar la contraseña.
 * Protegido con rate limiting: 3 intentos por 15 minutos.
 */
router.post(
  '/recover-password/:user_id',
  passwordResetRateLimiter,
  setPasswordController
);

/**
 * POST /api/auth/logout
 * Logout endpoint
 * Clears the HttpOnly cookie containing the JWT token
 */
router.post('/logout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('token', '', {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 0,
      path: '/',
    });

    await new Promise<void>((resolve, reject) => {
      logoutController(req, res, (err: any) => {
        if (err) reject(err);
        else resolve();
      });
    });
  } catch (error) {
    next(error);
  }
});

export default router;
