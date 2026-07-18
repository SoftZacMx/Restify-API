/// <reference types="jest" />

import { AuthMiddleware } from '../../../src/server/middleware/auth.middleware';
import { MANAGER_AND_UP } from '../../../src/shared/constants/roles.constants';
import { AppError } from '../../../src/shared/errors';

/**
 * Guard de autorización de las rutas de ESCRITURA de receta
 * (PUT /recipe, POST/PATCH/DELETE /recipe/items en menu-item.routes.ts).
 *
 * Estas rutas usan `AuthMiddleware.authorize(...MANAGER_AND_UP)`. Este test fija ese
 * contrato: OWNER, ADMIN y MANAGER pueden guardar recetas; WAITER, CHEF y usuarios sin
 * rol reciben FORBIDDEN. Regresión del bug donde el guard era `authorize('ADMIN')` y
 * excluía a OWNER y MANAGER (403 "acceso prohibido" al guardar receta).
 */
describe('Recipe write authorization guard (authorize(...MANAGER_AND_UP))', () => {
  // Reproduce el middleware exacto que montan las rutas de escritura de receta.
  const guard = AuthMiddleware.authorize(...MANAGER_AND_UP);

  function run(rol: string | undefined) {
    const req: any = { user: rol ? { rol } : undefined };
    const res: any = {};
    const next = jest.fn();
    guard(req, res, next);
    return next;
  }

  it.each(['OWNER', 'ADMIN', 'MANAGER'])(
    'permite al rol %s guardar recetas (next() sin error)',
    (rol) => {
      const next = run(rol);
      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
    }
  );

  it.each(['WAITER', 'CHEF'])(
    'rechaza al rol %s con FORBIDDEN',
    (rol) => {
      const next = run(rol);
      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.code).toBe('FORBIDDEN');
    }
  );

  it('rechaza a un usuario sin rol (sin sesión) con FORBIDDEN', () => {
    const next = run(undefined);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(AppError);
    expect(err.code).toBe('FORBIDDEN');
  });
});
