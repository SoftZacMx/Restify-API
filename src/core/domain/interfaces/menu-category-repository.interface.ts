import { MenuCategory } from '../entities/menu-category.entity';

export interface MenuCategoryFilters {
  status?: boolean;
  search?: string; // For searching by name
}

export interface IMenuCategoryRepository {
  findById(id: string): Promise<MenuCategory | null>;
  findByName(name: string): Promise<MenuCategory | null>;
  findAll(filters?: MenuCategoryFilters): Promise<MenuCategory[]>;
  create(data: {
    name: string;
    status: boolean;
  }): Promise<MenuCategory>;
  update(id: string, data: {
    name?: string;
    status?: boolean;
  }): Promise<MenuCategory>;
  delete(id: string): Promise<void>;
}

