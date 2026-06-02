import { JwtUtil } from '../../src/shared/utils/jwt.util';
import { UserRole } from '@prisma/client';

describe('Auth Multi-Tenant', () => {
  describe('JWT Payload', () => {
    it('should generate token with multi-tenant payload', () => {
      const payload = {
        sub: 'user-id-123',
        email: 'owner@example.com',
        rol: UserRole.OWNER,
        org: 'org-id-456',
        branch: 'branch-id-789',
        tokenVersion: 0,
        emailVerified: true,
        mustChangePassword: false,
      };

      const token = JwtUtil.generateToken(payload, '8h');

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    it('should verify token and decode payload', () => {
      const payload = {
        sub: 'user-id-123',
        email: 'owner@example.com',
        rol: UserRole.OWNER,
        org: 'org-id-456',
        branch: 'branch-id-789',
        tokenVersion: 0,
        emailVerified: true,
        mustChangePassword: false,
      };

      const token = JwtUtil.generateToken(payload, '8h');
      const decoded = JwtUtil.verifyToken(token);

      expect(decoded.sub).toBe('user-id-123');
      expect(decoded.email).toBe('owner@example.com');
      expect(decoded.rol).toBe(UserRole.OWNER);
      expect(decoded.org).toBe('org-id-456');
      expect(decoded.branch).toBe('branch-id-789');
      expect(decoded.tokenVersion).toBe(0);
      expect(decoded.emailVerified).toBe(true);
      expect(decoded.mustChangePassword).toBe(false);
    });

    it('should generate token without branch (org-level only)', () => {
      const payload = {
        sub: 'user-id-123',
        email: 'owner@example.com',
        rol: UserRole.OWNER,
        org: 'org-id-456',
        branch: undefined,
        tokenVersion: 0,
        emailVerified: false,
        mustChangePassword: true,
      };

      const token = JwtUtil.generateToken(payload, '8h');
      const decoded = JwtUtil.verifyToken(token);

      expect(decoded.org).toBe('org-id-456');
      expect(decoded.branch).toBeUndefined();
      expect(decoded.mustChangePassword).toBe(true);
    });

    it('should handle token expiration', () => {
      const payload = {
        sub: 'user-id-123',
        email: 'test@example.com',
        rol: UserRole.WAITER,
        org: 'org-id',
        branch: 'branch-id',
        tokenVersion: 0,
        emailVerified: true,
        mustChangePassword: false,
      };

      // Generate token that expires in 1ms
      const token = JwtUtil.generateToken(payload, '1ms');

      // Wait for token to expire
      return new Promise((resolve) => {
        setTimeout(() => {
          expect(() => JwtUtil.verifyToken(token)).toThrow('Invalid token');
          resolve(undefined);
        }, 10);
      });
    });
  });

  describe('Token Version (Revocation)', () => {
    it('should validate tokenVersion matches', () => {
      const payloadV0 = {
        sub: 'user-id',
        email: 'user@example.com',
        rol: UserRole.MANAGER,
        org: 'org-id',
        branch: 'branch-id',
        tokenVersion: 0,
        emailVerified: true,
        mustChangePassword: false,
      };

      const payloadV1 = {
        ...payloadV0,
        tokenVersion: 1,
      };

      const tokenV0 = JwtUtil.generateToken(payloadV0, '8h');
      const tokenV1 = JwtUtil.generateToken(payloadV1, '8h');

      const decodedV0 = JwtUtil.verifyToken(tokenV0);
      const decodedV1 = JwtUtil.verifyToken(tokenV1);

      expect(decodedV0.tokenVersion).toBe(0);
      expect(decodedV1.tokenVersion).toBe(1);

      // In real scenario, if user.tokenVersion in DB is 1,
      // tokenV0 would be rejected by validateTokenAndStatus middleware
    });
  });

  describe('Role-Based Access', () => {
    it('should include role in JWT for authorization', () => {
      const roles = [UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.WAITER, UserRole.CHEF];

      roles.forEach((role) => {
        const payload = {
          sub: 'user-id',
          email: 'user@example.com',
          rol: role,
          org: 'org-id',
          branch: 'branch-id',
          tokenVersion: 0,
          emailVerified: true,
          mustChangePassword: false,
        };

        const token = JwtUtil.generateToken(payload, '8h');
        const decoded = JwtUtil.verifyToken(token);

        expect(decoded.rol).toBe(role);
      });
    });
  });

  describe('Branch Context', () => {
    it('should allow switching branch by re-issuing token', () => {
      const initialPayload = {
        sub: 'user-id',
        email: 'user@example.com',
        rol: UserRole.ADMIN,
        org: 'org-id',
        branch: 'branch-1',
        tokenVersion: 0,
        emailVerified: true,
        mustChangePassword: false,
      };

      const initialToken = JwtUtil.generateToken(initialPayload, '8h');
      const decodedInitial = JwtUtil.verifyToken(initialToken);

      expect(decodedInitial.branch).toBe('branch-1');

      // Switch to branch-2
      const switchedPayload = {
        ...initialPayload,
        branch: 'branch-2',
      };

      const switchedToken = JwtUtil.generateToken(switchedPayload, '8h');
      const decodedSwitched = JwtUtil.verifyToken(switchedToken);

      expect(decodedSwitched.branch).toBe('branch-2');
      expect(decodedSwitched.org).toBe('org-id');
    });
  });

  describe('Email Verification & Password Change', () => {
    it('should include emailVerified flag in JWT', () => {
      const payloadUnverified = {
        sub: 'user-id',
        email: 'new-user@example.com',
        rol: UserRole.WAITER,
        org: 'org-id',
        branch: 'branch-id',
        tokenVersion: 0,
        emailVerified: false,
        mustChangePassword: true,
      };

      const token = JwtUtil.generateToken(payloadUnverified, '8h');
      const decoded = JwtUtil.verifyToken(token);

      expect(decoded.emailVerified).toBe(false);
      expect(decoded.mustChangePassword).toBe(true);

      // Frontend can check these flags and redirect to verification/password change
    });

    it('should include mustChangePassword flag for password reset', () => {
      const payload = {
        sub: 'user-id',
        email: 'user@example.com',
        rol: UserRole.MANAGER,
        org: 'org-id',
        branch: 'branch-id',
        tokenVersion: 0,
        emailVerified: true,
        mustChangePassword: true,
      };

      const token = JwtUtil.generateToken(payload, '8h');
      const decoded = JwtUtil.verifyToken(token);

      expect(decoded.mustChangePassword).toBe(true);
    });
  });
});
