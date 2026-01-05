import { PrismaClient } from '@prisma/client';
import { IMenuCategoryRepository, MenuCategoryFilters } from '../../../domain/interfaces/menu-category-repository.interface';
import { MenuCategory } from '../../../domain/entities/menu-category.entity';

export class MenuCategoryRepository implements IMenuCategoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<MenuCategory | null> {
    const category = await this.prisma.menuCategory.findUnique({
      where: { id },
    });

    if (!category) {
      return null;
    }

    return new MenuCategory(
      category.id,
      category.name,
      category.status,
      category.createdAt,
      category.updatedAt
    );
  }

  async findByName(name: string): Promise<MenuCategory | null> {
    const category = await this.prisma.menuCategory.findFirst({
      where: { name },
    });

    if (!category) {
      return null;
    }

    return new MenuCategory(
      category.id,
      category.name,
      category.status,
      category.createdAt,
      category.updatedAt
    );
  }

  async findAll(filters?: MenuCategoryFilters): Promise<MenuCategory[]> {
    const where: any = {};

    if (filters?.status !== undefined) {
      where.status = filters.status;
    }

    if (filters?.search) {
      where.name = { contains: filters.search };
    }

    const categories = await this.prisma.menuCategory.findMany({
      where,
      orderBy: {
        name: 'asc',
      },
    });

    return categories.map(
      (category) =>
        new MenuCategory(
          category.id,
          category.name,
          category.status,
          category.createdAt,
          category.updatedAt
        )
    );
  }

  async create(data: {
    name: string;
    status: boolean;
  }): Promise<MenuCategory> {
    const category = await this.prisma.menuCategory.create({
      data: {
        name: data.name,
        status: data.status,
      },
    });

    return new MenuCategory(
      category.id,
      category.name,
      category.status,
      category.createdAt,
      category.updatedAt
    );
  }

  async update(
    id: string,
    data: {
      name?: string;
      status?: boolean;
    }
  ): Promise<MenuCategory> {
    const updateData: any = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.status !== undefined) updateData.status = data.status;

    const category = await this.prisma.menuCategory.update({
      where: { id },
      data: updateData,
    });

    return new MenuCategory(
      category.id,
      category.name,
      category.status,
      category.createdAt,
      category.updatedAt
    );
  }

  async delete(id: string): Promise<void> {
    await this.prisma.menuCategory.delete({
      where: { id },
    });
  }
}

