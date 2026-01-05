import { inject, injectable } from 'tsyringe';
import { IMenuCategoryRepository } from '../../../domain/interfaces/menu-category-repository.interface';
import { GetMenuCategoryInput } from '../../dto/menu-category.dto';
import { AppError } from '../../../../shared/errors';

export interface GetMenuCategoryResult {
  id: string;
  name: string;
  status: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@injectable()
export class GetMenuCategoryUseCase {
  constructor(
    @inject('IMenuCategoryRepository') private readonly menuCategoryRepository: IMenuCategoryRepository
  ) {}

  async execute(input: GetMenuCategoryInput): Promise<GetMenuCategoryResult> {
    const category = await this.menuCategoryRepository.findById(input.category_id);

    if (!category) {
      throw new AppError('MENU_CATEGORY_NOT_FOUND');
    }

    return {
      id: category.id,
      name: category.name,
      status: category.status,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }
}

