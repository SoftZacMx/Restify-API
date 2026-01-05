import { Product } from '../entities/product.entity';

export interface ProductFilters {
  status?: boolean;
  userId?: string;
  search?: string; // Search by name
}

export interface IProductRepository {
  findById(id: string): Promise<Product | null>;
  findByIds(ids: string[]): Promise<Product[]>;
  findAll(filters?: ProductFilters): Promise<Product[]>;
  create(data: {
    name: string;
    description: string | null;
    status: boolean;
    userId: string;
  }): Promise<Product>;
  update(id: string, data: {
    name?: string;
    description?: string | null;
    status?: boolean;
  }): Promise<Product>;
  delete(id: string): Promise<void>;
}

