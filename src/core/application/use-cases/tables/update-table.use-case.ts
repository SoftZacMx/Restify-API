import { inject, injectable } from 'tsyringe';
import { ITableRepository } from '../../../domain/interfaces/table-repository.interface';
import { UpdateTableInput } from '../../dto/table.dto';
import { AppError } from '../../../../shared/errors';

export interface UpdateTableResult {
  id: string;
  numberTable: number;
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
    // Check if table exists
    const existingTable = await this.tableRepository.findById(tableId);
    if (!existingTable) {
      throw new AppError('TABLE_NOT_FOUND');
    }

    // If numberTable is being updated, check if new number already exists
    if (input.numberTable !== undefined && input.numberTable !== existingTable.numberTable) {
      const tableWithNumber = await this.tableRepository.findByNumberTable(input.numberTable);
      if (tableWithNumber) {
        throw new AppError('VALIDATION_ERROR', 'Table number already exists');
      }
    }

    // Prepare update data
    const updateData: any = {};

    if (input.numberTable !== undefined) updateData.numberTable = input.numberTable;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.availabilityStatus !== undefined) updateData.availabilityStatus = input.availabilityStatus;

    // Update table
    const table = await this.tableRepository.update(tableId, updateData);

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

