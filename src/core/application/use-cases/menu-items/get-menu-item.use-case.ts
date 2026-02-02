import { inject, injectable } from 'tsyringe';
import { IMenuItemRepository } from '../../../domain/interfaces/menu-item-repository.interface';
import { GetMenuItemInput } from '../../dto/menu-item.dto';
import { AppError } from '../../../../shared/errors';

export interface GetMenuItemResult {
  id: string;
  name: string;
  price: number;
  status: boolean;
  isExtra: boolean;
  categoryId: string | null;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

@injectable()
export class GetMenuItemUseCase {
  constructor(
    @inject('IMenuItemRepository') private readonly menuItemRepository: IMenuItemRepository
  ) {}

  async execute(input: GetMenuItemInput): Promise<GetMenuItemResult> {
    const menuItem = await this.menuItemRepository.findById(input.menu_item_id);

    if (!menuItem) {
      throw new AppError('MENU_ITEM_NOT_FOUND');
    }

    return {
      id: menuItem.id,
      name: menuItem.name,
      price: menuItem.price,
      status: menuItem.status,
      isExtra: menuItem.isExtra,
      categoryId: menuItem.categoryId,
      userId: menuItem.userId,
      createdAt: menuItem.createdAt,
      updatedAt: menuItem.updatedAt,
    };
  }
}

