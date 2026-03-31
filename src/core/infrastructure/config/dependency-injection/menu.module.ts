import { container } from 'tsyringe';
import { MenuCategoryRepository } from '../../database/repositories/menu-category.repository';
import { IMenuCategoryRepository } from '../../../domain/interfaces/menu-category-repository.interface';
import { MenuItemRepository } from '../../database/repositories/menu-item.repository';
import { IMenuItemRepository } from '../../../domain/interfaces/menu-item-repository.interface';
import { prismaClient } from './prisma.module';

container.register<IMenuCategoryRepository>('IMenuCategoryRepository', {
  useFactory: () => new MenuCategoryRepository(prismaClient),
});

container.register<IMenuItemRepository>('IMenuItemRepository', {
  useFactory: () => new MenuItemRepository(prismaClient),
});
