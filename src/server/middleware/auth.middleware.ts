import { Request, Response, NextFunction } from 'express';
import { JwtUtil, JwtPayload } from '../../shared/utils/jwt.util';
import { AppError } from '../../shared/errors';

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

/**
 * Authentication middleware for Express routes
 * Validates JWT token from cookie (HttpOnly) or Authorization header (fallback)
 */
export class AuthMiddleware {
  /**
   * Extract token from cookie or Authorization header
   */
  private static extractToken(req: Request): string | null {
    // Priority 1: Try to get token from HttpOnly cookie
    if (req.cookies && req.cookies.token) {
      return req.cookies.token;
    }

    // Priority 2: Fallback to Authorization header (for compatibility)
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const parts = authHeader.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        return parts[1];
      }
    }

    return null;
  }

  static authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
    try {
      const token = AuthMiddleware.extractToken(req);

      if (!token) {
        throw new AppError('UNAUTHORIZED', 'Authentication token is required');
      }

      const payload = JwtUtil.verifyToken(token);
      req.user = payload;
      next();
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
          timestamp: new Date().toISOString(),
        });
      } else {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid or expired token',
          },
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  /**
   * Optional authentication - doesn't fail if token is missing
   * Useful for endpoints that work with or without auth
   */
  static optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
    try {
      const token = AuthMiddleware.extractToken(req);

      if (token) {
        const payload = JwtUtil.verifyToken(token);
        req.user = payload;
      }
      next();
    } catch (error) {
      // If token is invalid, continue without user (optional auth)
      next();
    }
  }
}

