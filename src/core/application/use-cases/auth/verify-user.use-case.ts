import { inject, injectable } from 'tsyringe';
import { IUserRepository } from '../../../domain/interfaces/user-repository.interface';
import { JwtUtil } from '../../../../shared/utils/jwt.util';
import { VerifyUserInput } from '../../dto/auth.dto';
import { AppError } from '../../../../shared/errors';

export interface VerifyUserResult {
  id: string;
  email: string;
  name: string;
  last_name: string;
  second_last_name: string | null;
  rol: string;
  token: string;
}

@injectable()
export class VerifyUserUseCase {
  constructor(
    @inject('IUserRepository') private readonly userRepository: IUserRepository
  ) {}

  async execute(input: VerifyUserInput): Promise<VerifyUserResult> {
    const { email } = input;

    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      throw new AppError('USER_NOT_FOUND');
    }

    // Generate token for password reset
    const token = JwtUtil.generateToken(
      { email: user.email, userId: user.id },
      '1h' // Shorter expiration for password reset
    );

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      last_name: user.last_name,
      second_last_name: user.second_last_name,
      rol: user.rol,
      token,
    };
  }
}

