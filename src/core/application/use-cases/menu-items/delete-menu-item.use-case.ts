import { inject, injectable } from 'tsyringe';
import { IMenuItemRepository } from '../../../domain/interfaces/menu-item-repository.interface';
import { DeleteMenuItemInput } from '../../dto/menu-item.dto';
import { AppError } from '../../../../shared/errors';

@injectable()
export class DeleteMenuItemUseCase {
  constructor(
    @inject('IMenuItemRepository') private readonly menuItemRepository: IMenuItemRepository
  ) {}

  async execute(input: DeleteMenuItemInput): Promise<void> {
    // Check if menu item exists
    const menuItem = await this.menuItemRepository.findById(input.menu_item_id);
    if (!menuItem) {
      throw new AppError('MENU_ITEM_NOT_FOUND');
    }

    // Delete menu item
    await this.menuItemRepository.delete(input.menu_item_id);
  }
}

