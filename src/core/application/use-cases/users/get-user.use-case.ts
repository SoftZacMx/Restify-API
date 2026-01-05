import { inject, injectable } from 'tsyringe';
import { IUserRepository } from '../../../domain/interfaces/user-repository.interface';
import { GetUserInput } from '../../dto/user.dto';
import { AppError } from '../../../../shared/errors';

export interface GetUserResult {
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
export class GetUserUseCase {
  constructor(
    @inject('IUserRepository') private readonly userRepository: IUserRepository
  ) {}

  async execute(input: GetUserInput): Promise<GetUserResult> {
    const user = await this.userRepository.findById(input.user_id);

    if (!user) {
      throw new AppError('USER_NOT_FOUND');
    }

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

