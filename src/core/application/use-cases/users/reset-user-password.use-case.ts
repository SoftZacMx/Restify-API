import { inject, injectable } from 'tsyringe';
import { IUserRepository } from '../../../domain/interfaces/user-repository.interface';
import { ResetUserPasswordInput } from '../../dto/user.dto';
import { AppError } from '../../../../shared/errors';
import { getOrganizationId } from '../../../infrastructure/tenant/tenant-context';

/**
 * Sub-fase 4.1.C — Reset-password de empleados (owner/admin).
 *
 * No genera ni envía una contraseña nueva: marca `mustChangePassword = true`
 * (el empleado define su clave en el próximo login) e incrementa `tokenVersion`
 * para invalidar sus sesiones activas.
 */
@injectable()
export class ResetUserPasswordUseCase {
  constructor(
    @inject('IUserRepository') private readonly userRepository: IUserRepository
  ) {}

  async execute(input: ResetUserPasswordInput): Promise<void> {
    const user = await this.userRepository.findById(input.user_id);

    // Usuario inexistente o de otra org → 404 (no se revela su existencia).
    if (!user || user.organizationId !== getOrganizationId()) {
      throw new AppError('USER_NOT_FOUND');
    }

    await this.userRepository.markForPasswordReset(user.id);
  }
}
