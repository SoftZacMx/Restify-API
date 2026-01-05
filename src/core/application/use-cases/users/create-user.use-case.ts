import { inject, injectable } from 'tsyringe';
import { IUserRepository } from '../../../domain/interfaces/user-repository.interface';
import { CreateUserInput } from '../../dto/user.dto';
import { AppError } from '../../../../shared/errors';
import { BcryptUtil } from '../../../../shared/utils/bcrypt.util';

export interface CreateUserResult {
  id: string;
  name: string;
  last_name: string;
  second_last_name: string | null;
  email: string;
  phone: string | null;
  status: boolean;
  rol: string;
  createdAt: Date;
  updatedAt: Date;
}

@injectable()
export class CreateUserUseCase {
  constructor(
    @inject('IUserRepository') private readonly userRepository: IUserRepository
  ) {}

  async execute(input: CreateUserInput): Promise<CreateUserResult> {
    // Check if user with email already exists
    const existingUser = await this.userRepository.findByEmail(input.email);
    if (existingUser) {
      throw new AppError('VALIDATION_ERROR', 'User with this email already exists');
    }

    // Hash password
    const hashedPassword = await BcryptUtil.hash(input.password);

    // Create user
    const user = await this.userRepository.create({
      name: input.name,
      last_name: input.last_name,
      second_last_name: input.second_last_name || null,
      email: input.email,
      password: hashedPassword,
      phone: input.phone || null,
      status: input.status ?? true,
      rol: input.rol,
    });

    // Return user without password
    return {
      id: user.id,
      name: user.name,
      last_name: user.last_name,
      second_last_name: user.second_last_name,
      email: user.email,
      phone: user.phone,
      status: user.status,
      rol: user.rol,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}

