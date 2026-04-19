import { inject, injectable } from 'tsyringe';
import { IUserRepository } from '../../../domain/interfaces/user-repository.interface';
import { BcryptUtil } from '../../../../shared/utils/bcrypt.util';
import { JwtUtil } from '../../../../shared/utils/jwt.util';
import { LoginInput } from '../../dto/auth.dto';
import { AppError } from '../../../../shared/errors';

export interface LoginResult {
  token: string;
  user: {
    id: string;
    name: string;
    last_name: string;
    second_last_name: string | null;
    rol: string;
  };
}

@injectable()
export class LoginUseCase {
  constructor(
    @inject('IUserRepository') private readonly userRepository: IUserRepository
  ) {}

  async execute(input: LoginInput): Promise<LoginResult> {
    const { email, password } = input;

    // Find user by email
    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      throw new AppError('USER_NOT_FOUND');
    }

    if (!user.isActive()) {
      throw new AppError('USER_NOT_ACTIVE');
    }

    // Verify password
    const isPasswordValid = await BcryptUtil.compare(password, user.password);

    if (!isPasswordValid) {
      throw new AppError('PASSWORD_INCORRECT');
    }

    // Generate token
    const token = JwtUtil.generateToken({
      email: user.email,
      userId: user.id,
      rol: user.rol,
    });

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        last_name: user.last_name,
        second_last_name: user.second_last_name,
        rol: user.rol,
      },
    };
  }
}

