import { Router, Request, Response, NextFunction } from 'express';
import { loginController } from '../../controllers/auth/login.controller';
import { verifyUserController } from '../../controllers/auth/verify-user.controller';
import { setPasswordController } from '../../controllers/auth/set-password.controller';
import { logoutController } from '../../controllers/auth/logout.controller';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { loginSchema, verifyUserSchema } from '../../core/application/dto/auth.dto';
import { authRateLimiter, passwordResetRateLimiter } from '../middleware/rate-limit.middleware';

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
      // Intercept res.json to set cookie before sending response
      await new Promise<void>((resolve, reject) => {
        const originalJsonFn = res.json.bind(res);
        res.json = function (body: any) {
          if (body?.success && body?.data?.token) {
            const isProduction = process.env.NODE_ENV === 'production';
            res.cookie('token', body.data.token, {
              httpOnly: true,
              secure: isProduction,
              sameSite: 'strict',
              maxAge: 24 * 60 * 60 * 1000,
              path: '/',
            });
          }
          originalJsonFn(body);
          resolve();
          return res;
        };

        loginController(req, res, (err: any) => {
          res.json = originalJsonFn;
          if (err) reject(err);
        });
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
 * Protected with rate limiting: 3 attempts per 15 minutes
 */
router.post(
  '/set-password/:user_id',
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
