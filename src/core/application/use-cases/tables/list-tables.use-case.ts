import { inject, injectable } from 'tsyringe';
import { ITableRepository } from '../../../domain/interfaces/table-repository.interface';
import { ListTablesInput } from '../../dto/table.dto';

export interface ListTablesResult {
  id: string;
  name: string;
  userId: string;
  status: boolean;
  availabilityStatus: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@injectable()
export class ListTablesUseCase {
  constructor(
    @inject('ITableRepository') private readonly tableRepository: ITableRepository
  ) {}

  async execute(input?: ListTablesInput): Promise<ListTablesResult[]> {
    const filters = input
      ? {
          status: input.status,
          availabilityStatus: input.availabilityStatus,
          userId: input.userId,
          name: input.name,
        }
      : undefined;

    const tables = await this.tableRepository.findAll(filters);

    return tables.map((table) => ({
      id: table.id,
      name: table.name,
      userId: table.userId,
      status: table.status,
      availabilityStatus: table.availabilityStatus,
      createdAt: table.createdAt,
      updatedAt: table.updatedAt,
    }));
  }
}
