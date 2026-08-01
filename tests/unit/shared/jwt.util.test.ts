import jwt from 'jsonwebtoken';
import { JwtUtil } from '../../../src/shared/utils/jwt.util';

const SECRET = 'test-secret';

describe('JwtUtil', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = SECRET;
    delete process.env.JWT_EXPIRES_IN;
    (JwtUtil as unknown as { _secret: string | null })._secret = null;
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
    delete process.env.JWT_EXPIRES_IN;
    (JwtUtil as unknown as { _secret: string | null })._secret = null;
  });

  const authPayload = {
    sub: 'user-1',
    email: 'juan@example.com',
    rol: 'OWNER',
    org: 'org-1',
    branch: 'branch-1',
    tokenVersion: 1,
    emailVerified: true,
    mustChangePassword: false,
  };

  describe('SECRET', () => {
    it('lanza Error si falta JWT_SECRET', () => {
      delete process.env.JWT_SECRET;
      (JwtUtil as unknown as { _secret: string | null })._secret = null;

      expect(() => JwtUtil.generateToken(authPayload)).toThrow('JWT_SECRET environment variable is required');
    });
  });

  describe('generateToken / verifyToken', () => {
    it('firma un token verificable con el payload completo', () => {
      const token = JwtUtil.generateToken(authPayload);

      expect(typeof token).toBe('string');
      expect(JwtUtil.verifyToken(token)).toMatchObject(authPayload);
    });

    it('usa el expiresIn por defecto (JWT_EXPIRES_IN o 24h) cuando no se pasa', () => {
      process.env.JWT_EXPIRES_IN = '2h';
      const token = JwtUtil.generateToken(authPayload);

      const decoded = jwt.decode(token) as { exp: number; iat: number };
      const ttlHours = (decoded.exp - decoded.iat) / 3600;
      expect(ttlHours).toBeCloseTo(2, 1);
    });

    it('respeta un expiresIn custom', () => {
      const token = JwtUtil.generateToken(authPayload, '8h');

      const decoded = jwt.decode(token) as { exp: number; iat: number };
      const ttlHours = (decoded.exp - decoded.iat) / 3600;
      expect(ttlHours).toBeCloseTo(8, 1);
    });

    it('lanza Error al verificar un token inválido', () => {
      expect(() => JwtUtil.verifyToken('not-a-jwt')).toThrow('Invalid token');
    });

    it('lanza Error al verificar un token firmado con otro secreto', () => {
      const token = jwt.sign(authPayload, 'otro-secreto');

      expect(() => JwtUtil.verifyToken(token)).toThrow('Invalid token');
    });

    it('lanza Error al verificar un token expirado', () => {
      const token = jwt.sign(authPayload, SECRET, { expiresIn: '-1s' } as jwt.SignOptions);

      expect(() => JwtUtil.verifyToken(token)).toThrow('Invalid token');
    });
  });

  describe('decodeToken', () => {
    it('decodifica un token válido sin verificar firma', () => {
      const token = JwtUtil.generateToken(authPayload);

      expect(JwtUtil.decodeToken(token)).toMatchObject(authPayload);
    });

    it('devuelve null para un token basura', () => {
      expect(JwtUtil.decodeToken('garbage')).toBeNull();
    });

    it('devuelve null si jwt.decode lanza', () => {
      const spy = jest.spyOn(jwt, 'decode').mockImplementation(() => {
        throw new Error('boom');
      });
      expect(JwtUtil.decodeToken('x')).toBeNull();
      spy.mockRestore();
    });
  });

  describe('email verification tokens', () => {
    it('roundtrip: genera y verifica con purpose email_verification', () => {
      const token = JwtUtil.generateEmailVerificationToken({ sub: 'user-1', email: 'a@b.com' });

      expect(JwtUtil.verifyEmailVerificationToken(token)).toMatchObject({
        sub: 'user-1',
        email: 'a@b.com',
        purpose: 'email_verification',
      });
    });

    it('rechaza un token con otro purpose (p. ej. password reset)', () => {
      const token = JwtUtil.generatePasswordResetToken({ sub: 'user-1', email: 'a@b.com' });

      expect(() => JwtUtil.verifyEmailVerificationToken(token)).toThrow('Invalid token');
    });

    it('rechaza un token basura', () => {
      expect(() => JwtUtil.verifyEmailVerificationToken('garbage')).toThrow('Invalid token');
    });

    it('rechaza un token expirado', () => {
      const token = JwtUtil.generateEmailVerificationToken(
        { sub: 'user-1', email: 'a@b.com' },
        '-1s'
      );

      expect(() => JwtUtil.verifyEmailVerificationToken(token)).toThrow('Invalid token');
    });
  });

  describe('password reset tokens', () => {
    it('roundtrip: genera y verifica con purpose password_reset', () => {
      const token = JwtUtil.generatePasswordResetToken({ sub: 'user-1', email: 'a@b.com' });

      expect(JwtUtil.verifyPasswordResetToken(token)).toMatchObject({
        sub: 'user-1',
        email: 'a@b.com',
        purpose: 'password_reset',
      });
    });

    it('rechaza un token con otro purpose (p. ej. email verification)', () => {
      const token = JwtUtil.generateEmailVerificationToken({ sub: 'user-1', email: 'a@b.com' });

      expect(() => JwtUtil.verifyPasswordResetToken(token)).toThrow('Invalid token');
    });

    it('rechaza un token basura', () => {
      expect(() => JwtUtil.verifyPasswordResetToken('garbage')).toThrow('Invalid token');
    });
  });

  describe('organization reactivation tokens', () => {
    it('roundtrip: genera y verifica con purpose organization_reactivation', () => {
      const token = JwtUtil.generateOrganizationReactivationToken({
        sub: 'user-1',
        email: 'a@b.com',
        org: 'org-1',
      });

      expect(JwtUtil.verifyOrganizationReactivationToken(token)).toMatchObject({
        sub: 'user-1',
        email: 'a@b.com',
        org: 'org-1',
        purpose: 'organization_reactivation',
      });
    });

    it('rechaza un token con otro purpose', () => {
      const token = JwtUtil.generatePasswordResetToken({ sub: 'user-1', email: 'a@b.com' });

      expect(() => JwtUtil.verifyOrganizationReactivationToken(token)).toThrow('Invalid token');
    });

    it('rechaza un token basura', () => {
      expect(() => JwtUtil.verifyOrganizationReactivationToken('garbage')).toThrow('Invalid token');
    });
  });
});
