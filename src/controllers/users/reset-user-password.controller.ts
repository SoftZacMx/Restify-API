import { ResetUserPasswordUseCase } from '../../core/application/use-cases/users/reset-user-password.use-case';
import { makeController } from '../../shared/utils/make-controller';

export const resetUserPasswordController = makeController(ResetUserPasswordUseCase, {
  mapper: (req) => req.params,
  responseMapper: () => ({ message: 'Password reset. User must set a new password on next login.' }),
});
