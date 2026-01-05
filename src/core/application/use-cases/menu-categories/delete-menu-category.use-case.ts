import { inject, injectable } from 'tsyringe';
import { IMenuCategoryRepository } from '../../../domain/interfaces/menu-category-repository.interface';
import { DeleteMenuCategoryInput } from '../../dto/menu-category.dto';
import { AppError } from '../../../../shared/errors';

@injectable()
export class DeleteMenuCategoryUseCase {
  constructor(
    @inject('IMenuCategoryRepository') private readonly menuCategoryRepository: IMenuCategoryRepository
  ) {}

  async execute(input: DeleteMenuCategoryInput): Promise<void> {
    // Check if category exists
    const category = await this.menuCategoryRepository.findById(input.category_id);
    if (!category) {
      throw new AppError('MENU_CATEGORY_NOT_FOUND');
    }

    // Delete category
    await this.menuCategoryRepository.delete(input.category_id);
  }
}

