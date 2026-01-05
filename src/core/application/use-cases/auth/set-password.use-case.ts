import { inject, injectable } from 'tsyringe';
import { IUserRepository } from '../../../domain/interfaces/user-repository.interface';
import { BcryptUtil } from '../../../../shared/utils/bcrypt.util';
import { SetPasswordInput } from '../../dto/auth.dto';
import { AppError } from '../../../../shared/errors';

@injectable()
export class SetPasswordUseCase {
  constructor(
    @inject('IUserRepository') private readonly userRepository: IUserRepository
  ) {}

  async execute(input: SetPasswordInput): Promise<void> {
    const { password, user_id } = input;

    // Check if user exists
    const user = await this.userRepository.findById(user_id);

    if (!user) {
      throw new AppError('USER_NOT_FOUND');
    }

    // Hash new password
    const hashedPassword = await BcryptUtil.hash(password);

    // Update user password
    await this.userRepository.update(user_id, {
      password: hashedPassword,
    } as any);
  }
}

