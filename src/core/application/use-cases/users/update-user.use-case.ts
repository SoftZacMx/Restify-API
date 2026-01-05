import { inject, injectable } from 'tsyringe';
import { IUserRepository } from '../../../domain/interfaces/user-repository.interface';
import { UpdateUserInput } from '../../dto/user.dto';
import { AppError } from '../../../../shared/errors';
import { BcryptUtil } from '../../../../shared/utils/bcrypt.util';

export interface UpdateUserResult {
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
export class UpdateUserUseCase {
  constructor(
    @inject('IUserRepository') private readonly userRepository: IUserRepository
  ) {}

  async execute(userId: string, input: UpdateUserInput): Promise<UpdateUserResult> {
    // Check if user exists
    const existingUser = await this.userRepository.findById(userId);
    if (!existingUser) {
      throw new AppError('USER_NOT_FOUND');
    }

    // If email is being updated, check if new email already exists
    if (input.email && input.email !== existingUser.email) {
      const emailUser = await this.userRepository.findByEmail(input.email);
      if (emailUser) {
        throw new AppError('VALIDATION_ERROR', 'User with this email already exists');
      }
    }

    // Prepare update data
    const updateData: any = {};

    if (input.name !== undefined) updateData.name = input.name;
    if (input.last_name !== undefined) updateData.last_name = input.last_name;
    if (input.second_last_name !== undefined) updateData.second_last_name = input.second_last_name;
    if (input.email !== undefined) updateData.email = input.email;
    if (input.phone !== undefined) updateData.phone = input.phone;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.rol !== undefined) updateData.rol = input.rol;

    // Hash password if provided
    if (input.password) {
      updateData.password = await BcryptUtil.hash(input.password);
    }

    // Update user
    const user = await this.userRepository.update(userId, updateData);

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

