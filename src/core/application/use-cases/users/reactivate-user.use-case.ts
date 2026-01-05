import { inject, injectable } from 'tsyringe';
import { IUserRepository } from '../../../domain/interfaces/user-repository.interface';
import { ReactivateUserInput } from '../../dto/user.dto';
import { AppError } from '../../../../shared/errors';

@injectable()
export class ReactivateUserUseCase {
  constructor(
    @inject('IUserRepository') private readonly userRepository: IUserRepository
  ) {}

  async execute(input: ReactivateUserInput): Promise<void> {
    // Check if user exists
    const user = await this.userRepository.findById(input.user_id);
    if (!user) {
      throw new AppError('USER_NOT_FOUND');
    }

    // Check if user is already active
    if (user.isActive()) {
      throw new AppError('USER_ALREADY_ACTIVE', 'El usuario ya está activo');
    }

    // Reactivate user: change status to true
    await this.userRepository.reactivate(input.user_id);
  }
}

