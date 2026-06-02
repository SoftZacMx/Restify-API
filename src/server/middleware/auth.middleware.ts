import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { JwtUtil, JwtPayload } from '../../shared/utils/jwt.util';
import { AppError } from '../../shared/errors';
import { IUserRepository } from '../../core/domain/interfaces/user-repository.interface';
import { IOrganizationRepository } from '../../core/domain/interfaces/organization-repository.interface';

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
        next(error);
      } else {
        next(new AppError('UNAUTHORIZED', 'Invalid or expired token'));
      }
    }
  }

  /**
   * Role-based authorization middleware.
   * Must be used AFTER authenticate.
   * @param allowedRoles - Roles that can access the route
   */
  static authorize(...allowedRoles: string[]) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      const userRole = req.user?.rol;

      if (!userRole || !allowedRoles.includes(userRole)) {
        next(new AppError('FORBIDDEN', 'No tienes permisos para acceder a este recurso'));
        return;
      }

      next();
    };
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

  /**
   * Validate token version and user/org status.
   *
   * Use this after authenticate() for routes that need strict validation.
   * Validates:
   * - User's tokenVersion matches JWT (for token revocation)
   * - User account is active
   * - Organization is active
   *
   * Note: This queries the database. Consider adding cache (TTL 30-60s) for production.
   */
  static async validateTokenAndStatus(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('UNAUTHORIZED', 'Authentication required');
      }

      const userRepository = container.resolve<IUserRepository>('IUserRepository');
      const orgRepository = container.resolve<IOrganizationRepository>('IOrganizationRepository');

      // Validate user exists and token version
      const user = await userRepository.findById(req.user.sub);
      if (!user) {
        throw new AppError('USER_NOT_FOUND', 'User not found');
      }

      // Validate tokenVersion (for revocation)
      if (user.tokenVersion !== req.user.tokenVersion) {
        throw new AppError('TOKEN_REVOKED', 'Token has been revoked. Please login again.');
      }

      // Validate user account status
      if (!user.isAccountActive()) {
        throw new AppError('ACCOUNT_DISABLED', 'Account has been disabled');
      }

      // Validate organization status
      const org = await orgRepository.findById(user.organizationId);
      if (!org) {
        throw new AppError('ORGANIZATION_NOT_FOUND', 'Organization not found');
      }

      if (org.status !== 'ACTIVE') {
        throw new AppError('ORGANIZATION_INACTIVE', 'Organization is not active');
      }

      next();
    } catch (error) {
      next(error);
    }
  }
}
