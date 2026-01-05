import { inject, injectable } from 'tsyringe';
import { ITableRepository } from '../../../domain/interfaces/table-repository.interface';
import { IUserRepository } from '../../../domain/interfaces/user-repository.interface';
import { CreateTableInput } from '../../dto/table.dto';
import { AppError } from '../../../../shared/errors';

export interface CreateTableResult {
  id: string;
  numberTable: number;
  userId: string;
  status: boolean;
  availabilityStatus: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@injectable()
export class CreateTableUseCase {
  constructor(
    @inject('ITableRepository') private readonly tableRepository: ITableRepository,
    @inject('IUserRepository') private readonly userRepository: IUserRepository
  ) {}

  async execute(input: CreateTableInput): Promise<CreateTableResult> {
    // Verify that user exists
    const user = await this.userRepository.findById(input.userId);
    if (!user) {
      throw new AppError('USER_NOT_FOUND');
    }

    // Check if table number already exists
    const existingTable = await this.tableRepository.findByNumberTable(input.numberTable);
    if (existingTable) {
      throw new AppError('VALIDATION_ERROR', 'Table number already exists');
    }

    // Create table
    const table = await this.tableRepository.create({
      numberTable: input.numberTable,
      status: input.status ?? true,
      availabilityStatus: input.availabilityStatus ?? true,
      userId: input.userId,
    });

    return {
      id: table.id,
      numberTable: table.numberTable,
      userId: table.userId,
      status: table.status,
      availabilityStatus: table.availabilityStatus,
      createdAt: table.createdAt,
      updatedAt: table.updatedAt,
    };
  }
}

