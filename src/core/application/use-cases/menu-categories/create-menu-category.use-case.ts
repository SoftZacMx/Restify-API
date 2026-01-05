import { inject, injectable } from 'tsyringe';
import { IMenuCategoryRepository } from '../../../domain/interfaces/menu-category-repository.interface';
import { CreateMenuCategoryInput } from '../../dto/menu-category.dto';
import { AppError } from '../../../../shared/errors';

export interface CreateMenuCategoryResult {
  id: string;
  name: string;
  status: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@injectable()
export class CreateMenuCategoryUseCase {
  constructor(
    @inject('IMenuCategoryRepository') private readonly menuCategoryRepository: IMenuCategoryRepository
  ) {}

  async execute(input: CreateMenuCategoryInput): Promise<CreateMenuCategoryResult> {
    // Check if category name already exists
    const existingCategory = await this.menuCategoryRepository.findByName(input.name);
    if (existingCategory) {
      throw new AppError('VALIDATION_ERROR', 'Category name already exists');
    }

    // Create category
    const category = await this.menuCategoryRepository.create({
      name: input.name,
      status: input.status ?? true,
    });

    return {
      id: category.id,
      name: category.name,
      status: category.status,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }
}

