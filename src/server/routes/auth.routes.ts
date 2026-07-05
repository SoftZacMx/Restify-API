import { Router, Request, Response, NextFunction } from 'express';
import { verifyUserController } from '../../controllers/auth/verify-user.controller';
import { setPasswordController } from '../../controllers/auth/set-password.controller';
import { changeMyPasswordController } from '../../controllers/auth/change-my-password.controller';
import { logoutController } from '../../controllers/auth/logout.controller';
import { switchBranchController } from '../../controllers/auth/switch-branch.controller';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import {
  loginSchema,
  signupSchema,
  verifyUserSchema,
  switchBranchSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  changeMyPasswordSchema,
} from '../../core/application/dto/auth.dto';
import { authRateLimiter, passwordResetRateLimiter } from '../middleware/rate-limit.middleware';
import { AuthMiddleware, AuthenticatedRequest } from '../middleware/auth.middleware';

const router = Router();

/**
 * POST /api/auth/login
 * Login endpoint
 * Protected with rate limiting: 5 attempts per 15 minutes
 * Sets HttpOnly cookie with JWT token for secure authentication
 */
router.post(
  '/login',
  authRateLimiter,
  zodValidator({ schema: loginSchema, source: 'body' }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { container } = await import('tsyringe');
      const { LoginUseCase } = await import('../../core/application/use-cases/auth/login.use-case');

      const loginUseCase = container.resolve(LoginUseCase);
      const result = await loginUseCase.execute(req.body);

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
 * POST /api/auth/signup
 * Alta pública: crea organización + owner + primera sucursal (+ bootstrap).
 * Protegido con rate limiting: 5 intentos por 15 minutos.
 * Setea cookie HttpOnly con el JWT (igual que /login).
 */
router.post(
  '/signup',
  authRateLimiter,
  zodValidator({ schema: signupSchema, source: 'body' }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { container } = await import('tsyringe');
      const { SignupUseCase } = await import('../../core/application/use-cases/auth/signup.use-case');

      const signupUseCase = container.resolve(SignupUseCase);
      const result = await signupUseCase.execute(req.body);

      const isProduction = process.env.NODE_ENV === 'production';
      res.cookie('token', result.token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000,
        path: '/',
      });

      res.status(201).json({
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
    const isOwnUser = req.user?.sub === user_id;
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
router.post('/recover-password/:user_id', passwordResetRateLimiter, setPasswordController);

/**
 * POST /api/auth/change-my-password
 * Cambio de la propia contraseña (usuario autenticado). Pensado para el flujo forzado
 * por `mustChangePassword`: guarda la nueva clave y baja el flag. El userId sale del JWT.
 * Protegido con rate limiting: 3 intentos por 15 minutos.
 */
router.post(
  '/change-my-password',
  passwordResetRateLimiter,
  AuthMiddleware.authenticate,
  zodValidator({ schema: changeMyPasswordSchema, source: 'body' }),
  changeMyPasswordController
);

/**
 * Verificación de email (4.1.E) — confirma la titularidad del correo.
 * - GET  /api/auth/verify-email?token=...  → para el clic en el link del correo
 * - POST /api/auth/verify-email            → token en el body (uso desde el frontend)
 * Idempotente: si ya estaba verificado responde 200 con alreadyVerified=true.
 * Rate limited para evitar fuerza bruta sobre el token.
 */
async function handleVerifyEmail(token: string, res: Response, next: NextFunction): Promise<void> {
  try {
    const { container } = await import('tsyringe');
    const { VerifyEmailUseCase } = await import(
      '../../core/application/use-cases/auth/verify-email.use-case'
    );

    const useCase = container.resolve(VerifyEmailUseCase);
    const result = await useCase.execute({ token });

    res.status(200).json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

router.get(
  '/verify-email',
  passwordResetRateLimiter,
  zodValidator({ schema: verifyEmailSchema, source: 'query' }),
  (req: Request, res: Response, next: NextFunction) =>
    handleVerifyEmail(String(req.query.token), res, next)
);

router.post(
  '/verify-email',
  passwordResetRateLimiter,
  zodValidator({ schema: verifyEmailSchema, source: 'body' }),
  (req: Request, res: Response, next: NextFunction) =>
    handleVerifyEmail(req.body.token, res, next)
);

/**
 * POST /api/auth/resend-verification (4.1.E)
 * Reenvía el correo de verificación. Respuesta uniforme (anti-enumeración):
 * siempre 200 aunque el email no exista o ya esté verificado.
 * Rate limited: 3 intentos por 15 minutos.
 */
router.post(
  '/resend-verification',
  passwordResetRateLimiter,
  zodValidator({ schema: resendVerificationSchema, source: 'body' }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { container } = await import('tsyringe');
      const { ResendVerificationUseCase } = await import(
        '../../core/application/use-cases/auth/resend-verification.use-case'
      );

      const useCase = container.resolve(ResendVerificationUseCase);
      await useCase.execute(req.body);

      res.status(200).json({
        success: true,
        data: { message: 'Si la cuenta existe y no está verificada, se envió un correo.' },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/auth/switch-branch
 * Switch active branch endpoint
 * Generates new JWT token with updated branchId
 * Requires authentication
 */
router.post(
  '/switch-branch',
  AuthMiddleware.authenticate,
  zodValidator({ schema: switchBranchSchema, source: 'body' }),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await new Promise<void>((resolve, reject) => {
        switchBranchController(req, res, (err: any) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Set new token in cookie
      const result = res.locals.data;
      if (result?.token) {
        const isProduction = process.env.NODE_ENV === 'production';
        res.cookie('token', result.token, {
          httpOnly: true,
          secure: isProduction,
          sameSite: 'strict',
          maxAge: 24 * 60 * 60 * 1000,
          path: '/',
        });
      }
    } catch (error) {
      next(error);
    }
  }
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
