import { inject, injectable } from 'tsyringe';
import { ITableRepository } from '../../../domain/interfaces/table-repository.interface';
import { DeleteTableInput } from '../../dto/table.dto';
import { AppError } from '../../../../shared/errors';

@injectable()
export class DeleteTableUseCase {
  constructor(
    @inject('ITableRepository') private readonly tableRepository: ITableRepository
  ) {}

  async execute(input: DeleteTableInput): Promise<void> {
    // Check if table exists
    const table = await this.tableRepository.findById(input.table_id);
    if (!table) {
      throw new AppError('TABLE_NOT_FOUND');
    }

    // Delete table
    await this.tableRepository.delete(input.table_id);
  }
}

