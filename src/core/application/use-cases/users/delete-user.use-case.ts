import { inject, injectable } from 'tsyringe';
import { IUserRepository } from '../../../domain/interfaces/user-repository.interface';
import { DeleteUserInput } from '../../dto/user.dto';
import { AppError } from '../../../../shared/errors';

@injectable()
export class DeleteUserUseCase {
  constructor(
    @inject('IUserRepository') private readonly userRepository: IUserRepository
  ) {}

  async execute(input: DeleteUserInput): Promise<void> {
    // Check if user exists
    const user = await this.userRepository.findById(input.user_id);
    if (!user) {
      throw new AppError('USER_NOT_FOUND');
    }

    // Check if user is already deactivated (soft deleted)
    if (!user.isActive()) {
      throw new AppError('USER_ALREADY_DEACTIVATED', 'El usuario ya está desactivado');
    }

    // Soft delete: desactivar usuario en lugar de eliminarlo físicamente
    await this.userRepository.delete(input.user_id);
  }
}

