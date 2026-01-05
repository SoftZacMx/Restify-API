import { Table } from '../entities/table.entity';

export interface TableFilters {
  status?: boolean;
  availabilityStatus?: boolean;
  userId?: string;
  numberTable?: number;
}

export interface ITableRepository {
  findById(id: string): Promise<Table | null>;
  findByNumberTable(numberTable: number): Promise<Table | null>;
  findAll(filters?: TableFilters): Promise<Table[]>;
  create(data: {
    numberTable: number;
    status: boolean;
    availabilityStatus: boolean;
    userId: string;
  }): Promise<Table>;
  update(id: string, data: {
    numberTable?: number;
    status?: boolean;
    availabilityStatus?: boolean;
  }): Promise<Table>;
  delete(id: string): Promise<void>;
}

