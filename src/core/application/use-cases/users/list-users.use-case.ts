import { inject, injectable } from 'tsyringe';
import { IUserRepository } from '../../../domain/interfaces/user-repository.interface';
import { ListUsersInput } from '../../dto/user.dto';

export interface ListUsersResult {
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
export class ListUsersUseCase {
  constructor(
    @inject('IUserRepository') private readonly userRepository: IUserRepository
  ) {}

  async execute(input?: ListUsersInput): Promise<ListUsersResult[]> {
    const filters = input
      ? {
          rol: input.rol,
          status: input.status === 'all' 
            ? 'all' as const 
            : (typeof input.status === 'boolean' ? input.status : undefined),
          email: input.email,
        }
      : undefined;

    const users = await this.userRepository.findAll(filters);

    // Return users without passwords
    return users.map((user) => ({
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
    }));
  }
}

