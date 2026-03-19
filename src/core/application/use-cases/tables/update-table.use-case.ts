import { inject, injectable } from 'tsyringe';
import { ITableRepository } from '../../../domain/interfaces/table-repository.interface';
import { UpdateTableInput } from '../../dto/table.dto';
import { AppError } from '../../../../shared/errors';

export interface UpdateTableResult {
  id: string;
  name: string;
  userId: string;
  status: boolean;
  availabilityStatus: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@injectable()
export class UpdateTableUseCase {
  constructor(
    @inject('ITableRepository') private readonly tableRepository: ITableRepository
  ) {}

  async execute(tableId: string, input: UpdateTableInput): Promise<UpdateTableResult> {
    const existingTable = await this.tableRepository.findById(tableId);
    if (!existingTable) {
      throw new AppError('TABLE_NOT_FOUND');
    }

    if (input.name !== undefined && input.name !== existingTable.name) {
      const tableWithName = await this.tableRepository.findByName(input.name);
      if (tableWithName) {
        throw new AppError('VALIDATION_ERROR', 'Ya existe una mesa con ese nombre');
      }
    }

    const updateData: {
      name?: string;
      status?: boolean;
      availabilityStatus?: boolean;
    } = {};

    if (input.name !== undefined) updateData.name = input.name;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.availabilityStatus !== undefined) updateData.availabilityStatus = input.availabilityStatus;

    const table = await this.tableRepository.update(tableId, updateData);

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
