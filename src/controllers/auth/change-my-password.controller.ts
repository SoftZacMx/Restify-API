import { ChangeMyPasswordUseCase } from '../../core/application/use-cases/auth/change-my-password.use-case';
import { makeController } from '../../shared/utils/make-controller';

/**
 * POST /api/auth/change-my-password
 * makeController inyecta userId/role desde el JWT (requireAuth). El body (password)
 * ya viene validado por zodValidator en la ruta.
 */
export const changeMyPasswordController = makeController(ChangeMyPasswordUseCase, {
  mapper: (req) => ({ password: req.body.password }),
  responseMapper: () => ({ message: 'Password updated successfully' }),
  requireAuth: true,
});
