import { inject, injectable } from 'tsyringe';
import { IMenuCategoryRepository } from '../../../domain/interfaces/menu-category-repository.interface';
import { UpdateMenuCategoryInput } from '../../dto/menu-category.dto';
import { AppError } from '../../../../shared/errors';

export interface UpdateMenuCategoryResult {
  id: string;
  name: string;
  status: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@injectable()
export class UpdateMenuCategoryUseCase {
  constructor(
    @inject('IMenuCategoryRepository') private readonly menuCategoryRepository: IMenuCategoryRepository
  ) {}

  async execute(categoryId: string, input: UpdateMenuCategoryInput): Promise<UpdateMenuCategoryResult> {
    // Check if category exists
    const existingCategory = await this.menuCategoryRepository.findById(categoryId);
    if (!existingCategory) {
      throw new AppError('MENU_CATEGORY_NOT_FOUND');
    }

    // If name is being updated, check if new name already exists
    if (input.name !== undefined && input.name !== existingCategory.name) {
      const categoryWithName = await this.menuCategoryRepository.findByName(input.name);
      if (categoryWithName) {
        throw new AppError('VALIDATION_ERROR', 'Category name already exists');
      }
    }

    // Prepare update data
    const updateData: any = {};

    if (input.name !== undefined) updateData.name = input.name;
    if (input.status !== undefined) updateData.status = input.status;

    // Update category
    const category = await this.menuCategoryRepository.update(categoryId, updateData);

    return {
      id: category.id,
      name: category.name,
      status: category.status,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }
}

