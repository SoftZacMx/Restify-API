import { inject, injectable } from 'tsyringe';
import { ITableRepository } from '../../../domain/interfaces/table-repository.interface';
import { GetTableInput } from '../../dto/table.dto';
import { AppError } from '../../../../shared/errors';

export interface GetTableResult {
  id: string;
  name: string;
  userId: string;
  status: boolean;
  availabilityStatus: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@injectable()
export class GetTableUseCase {
  constructor(
    @inject('ITableRepository') private readonly tableRepository: ITableRepository
  ) {}

  async execute(input: GetTableInput): Promise<GetTableResult> {
    const table = await this.tableRepository.findById(input.table_id);

    if (!table) {
      throw new AppError('TABLE_NOT_FOUND');
    }

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
