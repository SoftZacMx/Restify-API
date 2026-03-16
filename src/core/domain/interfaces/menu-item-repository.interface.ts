import { MenuItem } from '../entities/menu-item.entity';

export interface MenuItemFilters {
  status?: boolean;
  isExtra?: boolean;
  categoryId?: string;
  userId?: string;
  search?: string; // For searching by name
}

export interface IMenuItemRepository {
  findById(id: string): Promise<MenuItem | null>;
  findByIds(ids: string[]): Promise<MenuItem[]>;
  findAll(filters?: MenuItemFilters): Promise<MenuItem[]>;
  create(data: {
    name: string;
    price: number;
    status: boolean;
    isExtra: boolean;
    categoryId: string | null;
    userId: string;
  }): Promise<MenuItem>;
  update(id: string, data: {
    name?: string;
    price?: number;
    status?: boolean;
    isExtra?: boolean;
    categoryId?: string;
    userId?: string;
  }): Promise<MenuItem>;
  delete(id: string): Promise<void>;
}

