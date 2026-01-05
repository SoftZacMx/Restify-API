import { inject, injectable } from 'tsyringe';
import { IMenuItemRepository } from '../../../domain/interfaces/menu-item-repository.interface';
import { IMenuCategoryRepository } from '../../../domain/interfaces/menu-category-repository.interface';
import { IUserRepository } from '../../../domain/interfaces/user-repository.interface';
import { UpdateMenuItemInput } from '../../dto/menu-item.dto';
import { AppError } from '../../../../shared/errors';

export interface UpdateMenuItemResult {
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
export class UpdateMenuItemUseCase {
  constructor(
    @inject('IMenuItemRepository') private readonly menuItemRepository: IMenuItemRepository,
    @inject('IMenuCategoryRepository') private readonly menuCategoryRepository: IMenuCategoryRepository,
    @inject('IUserRepository') private readonly userRepository: IUserRepository
  ) {}

  async execute(menuItemId: string, input: UpdateMenuItemInput): Promise<UpdateMenuItemResult> {
    // Check if menu item exists
    const existingMenuItem = await this.menuItemRepository.findById(menuItemId);
    if (!existingMenuItem) {
      throw new AppError('MENU_ITEM_NOT_FOUND');
    }

    // If categoryId is being updated, verify that category exists
    if (input.categoryId !== undefined) {
      const category = await this.menuCategoryRepository.findById(input.categoryId);
      if (!category) {
        throw new AppError('MENU_CATEGORY_NOT_FOUND');
      }
    }

    // If userId is being updated, verify that user exists
    if (input.userId !== undefined) {
      const user = await this.userRepository.findById(input.userId);
      if (!user) {
        throw new AppError('USER_NOT_FOUND');
      }
    }

    // Prepare update data
    const updateData: any = {};

    if (input.name !== undefined) updateData.name = input.name;
    if (input.price !== undefined) updateData.price = input.price;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.categoryId !== undefined) updateData.categoryId = input.categoryId;
    if (input.userId !== undefined) updateData.userId = input.userId;

    // Update menu item
    const menuItem = await this.menuItemRepository.update(menuItemId, updateData);

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

