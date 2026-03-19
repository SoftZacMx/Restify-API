import { Table } from '../entities/table.entity';

export interface TableFilters {
  status?: boolean;
  availabilityStatus?: boolean;
  userId?: string;
  name?: string;
}

export interface ITableRepository {
  findById(id: string): Promise<Table | null>;
  findByName(name: string): Promise<Table | null>;
  findAll(filters?: TableFilters): Promise<Table[]>;
  create(data: {
    name: string;
    status: boolean;
    availabilityStatus: boolean;
    userId: string;
  }): Promise<Table>;
  update(
    id: string,
    data: {
      name?: string;
      status?: boolean;
      availabilityStatus?: boolean;
    }
  ): Promise<Table>;
  delete(id: string): Promise<void>;
}
