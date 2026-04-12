import { inject, injectable } from 'tsyringe';
import { IMenuItemRepository, MenuItemFilters } from '../../../domain/interfaces/menu-item-repository.interface';
import { IMenuCategoryRepository } from '../../../domain/interfaces/menu-category-repository.interface';

export interface PublicMenuItem {
  id: string;
  name: string;
  price: number;
}

export interface PublicMenuCategory {
  id: string;
  name: string;
  items: PublicMenuItem[];
}

export interface ListPublicMenuResult {
  categories: PublicMenuCategory[];
  extras: PublicMenuItem[];
}

@injectable()
export class ListPublicMenuUseCase {
  constructor(
    @inject('IMenuItemRepository') private readonly menuItemRepository: IMenuItemRepository,
    @inject('IMenuCategoryRepository') private readonly menuCategoryRepository: IMenuCategoryRepository
  ) {}

  async execute(): Promise<ListPublicMenuResult> {
    const [categories, items, extras] = await Promise.all([
      this.menuCategoryRepository.findAll({ status: true }),
      this.menuItemRepository.findAll({ status: true, isExtra: false }),
      this.menuItemRepository.findAll({ status: true, isExtra: true }),
    ]);

    const categoryMap = new Map<string, PublicMenuItem[]>();
    for (const item of items) {
      if (!item.categoryId) continue;
      const list = categoryMap.get(item.categoryId) || [];
      list.push({ id: item.id, name: item.name, price: item.price });
      categoryMap.set(item.categoryId, list);
    }

    const result: PublicMenuCategory[] = categories
      .filter((cat) => categoryMap.has(cat.id))
      .map((cat) => ({
        id: cat.id,
        name: cat.name,
        items: categoryMap.get(cat.id)!,
      }));

    return {
      categories: result,
      extras: extras.map((e) => ({ id: e.id, name: e.name, price: e.price })),
    };
  }
}
