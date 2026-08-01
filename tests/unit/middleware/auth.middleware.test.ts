import { container } from 'tsyringe';
import { AuthMiddleware } from '../../../src/server/middleware/auth.middleware';
import { JwtUtil } from '../../../src/shared/utils/jwt.util';
import { AppError } from '../../../src/shared/errors';
import { User } from '../../../src/core/domain/entities/user.entity';
import { UserRole, UserAccountStatus } from '@prisma/client';

jest.mock('../../../src/shared/utils/jwt.util');

const PAYLOAD = {
  sub: 'user-1',
  email: 'juan@example.com',
  rol: 'OWNER',
  org: 'org-1',
  branch: 'branch-1',
  tokenVersion: 2,
  emailVerified: true,
  mustChangePassword: false,
};

function makeUser(overrides: Partial<Record<string, unknown>> = {}): User {
  return new User(
    'user-1',
    'Juan',
    'Perez',
    null,
    'juan@example.com',
    'hashed',
    null,
    true,
    UserRole.OWNER,
    'org-1',
    (overrides.accountStatus as UserAccountStatus) ?? UserAccountStatus.ACTIVE,
    (overrides.tokenVersion as number) ?? 2,
    new Date(),
    false,
    new Date(),
    new Date()
  );
}

describe('AuthMiddleware', () => {
  let next: jest.Mock;

  beforeEach(() => {
    next = jest.fn();
    (JwtUtil.verifyToken as jest.Mock).mockReturnValue(PAYLOAD);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('authenticate', () => {
    it('rechaza con UNAUTHORIZED cuando no hay token (ni cookie ni header)', () => {
      const req = { cookies: {}, headers: {} } as any;

      AuthMiddleware.authenticate(req, {} as any, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'UNAUTHORIZED' }));
      expect(req.user).toBeUndefined();
    });

    it('acepta el token de la cookie HttpOnly', () => {
      const req = { cookies: { token: 'cookie-token' }, headers: {} } as any;

      AuthMiddleware.authenticate(req, {} as any, next);

      expect(JwtUtil.verifyToken).toHaveBeenCalledWith('cookie-token');
      expect(req.user).toEqual({ ...PAYLOAD, userId: 'user-1' });
      expect(next).toHaveBeenCalledWith();
    });

    it('usa `userId` legacy si el payload no trae `sub`', () => {
      (JwtUtil.verifyToken as jest.Mock).mockReturnValue({ ...PAYLOAD, sub: undefined, userId: 'legacy-1' });
      const req = { cookies: { token: 't' }, headers: {} } as any;

      AuthMiddleware.authenticate(req, {} as any, next);

      expect(req.user.userId).toBe('legacy-1');
    });

    it('acepta el token del header Authorization con formato Bearer', () => {
      const req = { cookies: {}, headers: { authorization: 'Bearer header-token' } } as any;

      AuthMiddleware.authenticate(req, {} as any, next);

      expect(JwtUtil.verifyToken).toHaveBeenCalledWith('header-token');
      expect(req.user.userId).toBe('user-1');
    });

    it('ignora headers Authorization malformados', () => {
      const req = { cookies: {}, headers: { authorization: 'Basic abc123' } } as any;

      AuthMiddleware.authenticate(req, {} as any, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'UNAUTHORIZED' }));
    });

    it('envuelve un token inválido en AppError UNAUTHORIZED', () => {
      (JwtUtil.verifyToken as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });
      const req = { cookies: { token: 'expired' }, headers: {} } as any;

      AuthMiddleware.authenticate(req, {} as any, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'UNAUTHORIZED' }));
      expect(req.user).toBeUndefined();
    });

    it('propaga los AppError tal cual (p. ej. token expirado detectado por el verify)', () => {
      (JwtUtil.verifyToken as jest.Mock).mockImplementation(() => {
        throw new AppError('UNAUTHORIZED', 'Token has expired');
      });
      const req = { cookies: { token: 'expired' }, headers: {} } as any;

      AuthMiddleware.authenticate(req, {} as any, next);

      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.code).toBe('UNAUTHORIZED');
    });
  });

  describe('authorize', () => {
    it('deja pasar a un rol permitido', () => {
      const req = { user: { ...PAYLOAD, rol: 'OWNER' } } as any;

      AuthMiddleware.authorize('OWNER', 'ADMIN')(req, {} as any, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('rechaza con FORBIDDEN a un rol no permitido', () => {
      const req = { user: { ...PAYLOAD, rol: 'WAITER' } } as any;

      AuthMiddleware.authorize('OWNER', 'ADMIN')(req, {} as any, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'FORBIDDEN' }));
    });

    it('rechaza con FORBIDDEN si no hay usuario autenticado', () => {
      AuthMiddleware.authorize('OWNER')({} as any, {} as any, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'FORBIDDEN' }));
    });
  });

  describe('optionalAuth', () => {
    it('continúa sin usuario si no hay token', () => {
      const req = { cookies: {}, headers: {} } as any;

      AuthMiddleware.optionalAuth(req, {} as any, next);

      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalledWith();
    });

    it('adjunta el usuario si hay token válido', () => {
      const req = { cookies: { token: 't' }, headers: {} } as any;

      AuthMiddleware.optionalAuth(req, {} as any, next);

      expect(req.user.userId).toBe('user-1');
      expect(next).toHaveBeenCalledWith();
    });

    it('traga el error de token inválido y continúa sin usuario', () => {
      (JwtUtil.verifyToken as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });
      const req = { cookies: { token: 'expired' }, headers: {} } as any;

      AuthMiddleware.optionalAuth(req, {} as any, next);

      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('validateTokenAndStatus', () => {
    let mockUserRepository: any;
    let mockOrgRepository: any;

    beforeEach(() => {
      mockUserRepository = { findById: jest.fn().mockResolvedValue(makeUser()) };
      mockOrgRepository = { findById: jest.fn().mockResolvedValue({ id: 'org-1', status: 'ACTIVE' }) };
      container.register('IUserRepository', { useValue: mockUserRepository });
      container.register('IOrganizationRepository', { useValue: mockOrgRepository });
    });

    afterEach(() => {
      container.clearInstances();
    });

    it('rechaza con UNAUTHORIZED si no hay req.user', async () => {
      await AuthMiddleware.validateTokenAndStatus({} as any, {} as any, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'UNAUTHORIZED' }));
    });

    it('rechaza con USER_NOT_FOUND si el usuario ya no existe', async () => {
      mockUserRepository.findById.mockResolvedValue(null);
      const req = { user: PAYLOAD } as any;

      await AuthMiddleware.validateTokenAndStatus(req, {} as any, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'USER_NOT_FOUND' }));
    });

    it('rechaza con TOKEN_REVOKED si el tokenVersion no coincide', async () => {
      mockUserRepository.findById.mockResolvedValue(makeUser({ tokenVersion: 99 }));
      const req = { user: PAYLOAD } as any;

      await AuthMiddleware.validateTokenAndStatus(req, {} as any, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'TOKEN_REVOKED' }));
    });

    it('rechaza con ACCOUNT_DISABLED si la cuenta está deshabilitada', async () => {
      mockUserRepository.findById.mockResolvedValue(
        makeUser({ accountStatus: UserAccountStatus.DISABLED })
      );
      const req = { user: PAYLOAD } as any;

      await AuthMiddleware.validateTokenAndStatus(req, {} as any, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'ACCOUNT_DISABLED' }));
    });

    it('rechaza con ORGANIZATION_NOT_FOUND si la organización no existe', async () => {
      mockOrgRepository.findById.mockResolvedValue(null);
      const req = { user: PAYLOAD } as any;

      await AuthMiddleware.validateTokenAndStatus(req, {} as any, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'ORGANIZATION_NOT_FOUND' }));
    });

    it('rechaza con ORGANIZATION_INACTIVE si la organización no está activa', async () => {
      mockOrgRepository.findById.mockResolvedValue({ id: 'org-1', status: 'CANCELLED' });
      const req = { user: PAYLOAD } as any;

      await AuthMiddleware.validateTokenAndStatus(req, {} as any, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'ORGANIZATION_INACTIVE' }));
    });

    it('deja pasar cuando todo está válido', async () => {
      const req = { user: PAYLOAD } as any;

      await AuthMiddleware.validateTokenAndStatus(req, {} as any, next);

      expect(next).toHaveBeenCalledWith();
      expect(mockUserRepository.findById).toHaveBeenCalledWith('user-1');
    });
  });
});
