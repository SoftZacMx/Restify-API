import { inject, injectable } from 'tsyringe';
import { IMenuCategoryRepository } from '../../../domain/interfaces/menu-category-repository.interface';
import { ListMenuCategoriesInput } from '../../dto/menu-category.dto';

export interface ListMenuCategoriesResult {
  id: string;
  name: string;
  status: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@injectable()
export class ListMenuCategoriesUseCase {
  constructor(
    @inject('IMenuCategoryRepository') private readonly menuCategoryRepository: IMenuCategoryRepository
  ) {}

  async execute(input?: ListMenuCategoriesInput): Promise<ListMenuCategoriesResult[]> {
    const filters = input
      ? {
          status: input.status,
          search: input.search,
        }
      : undefined;

    const categories = await this.menuCategoryRepository.findAll(filters);

    return categories.map((category) => ({
      id: category.id,
      name: category.name,
      status: category.status,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    }));
  }
}

