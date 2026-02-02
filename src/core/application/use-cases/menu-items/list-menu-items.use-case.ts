import { inject, injectable } from 'tsyringe';
import { IMenuItemRepository } from '../../../domain/interfaces/menu-item-repository.interface';
import { ListMenuItemsInput } from '../../dto/menu-item.dto';

export interface ListMenuItemsResult {
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
export class ListMenuItemsUseCase {
  constructor(
    @inject('IMenuItemRepository') private readonly menuItemRepository: IMenuItemRepository
  ) {}

  async execute(input?: ListMenuItemsInput): Promise<ListMenuItemsResult[]> {
    const filters = input
      ? {
          status: input.status,
          isExtra: input.isExtra,
          categoryId: input.categoryId,
          userId: input.userId,
          search: input.search,
        }
      : undefined;

    const menuItems = await this.menuItemRepository.findAll(filters);

    return menuItems.map((menuItem) => ({
      id: menuItem.id,
      name: menuItem.name,
      price: menuItem.price,
      status: menuItem.status,
      isExtra: menuItem.isExtra,
      categoryId: menuItem.categoryId,
      userId: menuItem.userId,
      createdAt: menuItem.createdAt,
      updatedAt: menuItem.updatedAt,
    }));
  }
}

