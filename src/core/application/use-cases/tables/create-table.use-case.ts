import { inject, injectable } from 'tsyringe';
import { ITableRepository } from '../../../domain/interfaces/table-repository.interface';
import { IUserRepository } from '../../../domain/interfaces/user-repository.interface';
import { AppError } from '../../../../shared/errors';
import type { CreateTableInput } from '../../dto/table.dto';

@injectable()
export class CreateTableUseCase {
  constructor(
    @inject('ITableRepository') private readonly tableRepository: ITableRepository,
    @inject('IUserRepository') private readonly userRepository: IUserRepository
  ) {}

  async execute(input: CreateTableInput): Promise<{
    id: string;
    name: string;
    userId: string;
    status: boolean;
    availabilityStatus: boolean;
    createdAt: Date;
    updatedAt: Date;
  }> {
    const user = await this.userRepository.findById(input.userId);
    if (!user) {
      throw new AppError('USER_NOT_FOUND');
    }

    const existingTable = await this.tableRepository.findByName(input.name);
    if (existingTable) {
      throw new AppError('VALIDATION_ERROR', 'Ya existe una mesa con ese nombre');
    }

    const table = await this.tableRepository.create({
      name: input.name,
      status: input.status ?? true,
      availabilityStatus: input.availabilityStatus ?? true,
      userId: input.userId,
    });

    return {
      id: table.id,
      name: table.name,
      userId: table.userId,
      status: table.status,
      availabilityStatus: table.availabilityStatus,
      createdAt: table.createdAt,
      updatedAt: table.updatedAt,
    };
  }
}
