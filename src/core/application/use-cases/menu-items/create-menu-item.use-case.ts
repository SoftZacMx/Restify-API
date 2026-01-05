import { inject, injectable } from 'tsyringe';
import { IMenuItemRepository } from '../../../domain/interfaces/menu-item-repository.interface';
import { IMenuCategoryRepository } from '../../../domain/interfaces/menu-category-repository.interface';
import { IUserRepository } from '../../../domain/interfaces/user-repository.interface';
import { CreateMenuItemInput } from '../../dto/menu-item.dto';
import { AppError } from '../../../../shared/errors';

export interface CreateMenuItemResult {
  id: string;
  name: string;
  price: number;
  status: boolean;
  categoryId: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

@injectable()
export class CreateMenuItemUseCase {
  constructor(
    @inject('IMenuItemRepository') private readonly menuItemRepository: IMenuItemRepository,
    @inject('IMenuCategoryRepository') private readonly menuCategoryRepository: IMenuCategoryRepository,
    @inject('IUserRepository') private readonly userRepository: IUserRepository
  ) {}

  async execute(input: CreateMenuItemInput): Promise<CreateMenuItemResult> {
    // Verify that category exists
    const category = await this.menuCategoryRepository.findById(input.categoryId);
    if (!category) {
      throw new AppError('MENU_CATEGORY_NOT_FOUND');
    }

    // Verify that user exists
    const user = await this.userRepository.findById(input.userId);
    if (!user) {
      throw new AppError('USER_NOT_FOUND');
    }

    // Create menu item
    const menuItem = await this.menuItemRepository.create({
      name: input.name,
      price: input.price,
      status: input.status ?? true,
      categoryId: input.categoryId,
      userId: input.userId,
    });

    return {
      id: menuItem.id,
      name: menuItem.name,
      price: menuItem.price,
      status: menuItem.status,
      categoryId: menuItem.categoryId,
      userId: menuItem.userId,
      createdAt: menuItem.createdAt,
      updatedAt: menuItem.updatedAt,
    };
  }
}

