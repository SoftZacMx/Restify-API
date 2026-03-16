import { PrismaClient } from '@prisma/client';
import { IMenuItemRepository, MenuItemFilters } from '../../../domain/interfaces/menu-item-repository.interface';
import { MenuItem } from '../../../domain/entities/menu-item.entity';

export class MenuItemRepository implements IMenuItemRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<MenuItem | null> {
    const menuItem = await this.prisma.menuItem.findUnique({
      where: { id },
    });

    if (!menuItem) {
      return null;
    }

    return new MenuItem(
      menuItem.id,
      menuItem.name,
      Number(menuItem.price),
      Boolean(menuItem.status),
      Boolean(menuItem.isExtra), // Asegurar conversión explícita a boolean
      menuItem.categoryId,
      menuItem.userId,
      menuItem.createdAt,
      menuItem.updatedAt
    );
  }

  async findByIds(ids: string[]): Promise<MenuItem[]> {
    const uniqueIds = [...new Set(ids)].filter(Boolean);
    if (uniqueIds.length === 0) return [];
    const items = await this.prisma.menuItem.findMany({
      where: { id: { in: uniqueIds } },
    });
    return items.map(
      (menuItem) =>
        new MenuItem(
          menuItem.id,
          menuItem.name,
          Number(menuItem.price),
          Boolean(menuItem.status),
          Boolean(menuItem.isExtra),
          menuItem.categoryId,
          menuItem.userId,
          menuItem.createdAt,
          menuItem.updatedAt
        )
    );
  }

  async findAll(filters?: MenuItemFilters): Promise<MenuItem[]> {
    const where: any = {};

    if (filters?.status !== undefined) {
      where.status = filters.status;
    }

    if (filters?.isExtra !== undefined) {
      where.isExtra = filters.isExtra;
    }

    if (filters?.categoryId) {
      where.categoryId = filters.categoryId;
    }

    if (filters?.userId) {
      where.userId = filters.userId;
    }

    if (filters?.search) {
      where.name = { contains: filters.search };
    }

    const menuItems = await this.prisma.menuItem.findMany({
      where,
      orderBy: {
        name: 'asc',
      },
    });

    return menuItems.map(
      (menuItem) =>
        new MenuItem(
          menuItem.id,
          menuItem.name,
          Number(menuItem.price),
          Boolean(menuItem.status),
          Boolean(menuItem.isExtra), // Asegurar conversión explícita a boolean
          menuItem.categoryId,
          menuItem.userId,
          menuItem.createdAt,
          menuItem.updatedAt
        )
    );
  }

  async create(data: {
    name: string;
    price: number;
    status: boolean;
    isExtra: boolean;
    categoryId: string | null;
    userId: string;
  }): Promise<MenuItem> {
    const menuItem = await this.prisma.menuItem.create({
      data: {
        name: data.name,
        price: data.price,
        status: data.status,
        isExtra: data.isExtra,
        categoryId: data.categoryId,
        userId: data.userId,
      },
    });

    return new MenuItem(
      menuItem.id,
      menuItem.name,
      Number(menuItem.price),
      Boolean(menuItem.status),
      Boolean(menuItem.isExtra), // Asegurar conversión explícita a boolean
      menuItem.categoryId,
      menuItem.userId,
      menuItem.createdAt,
      menuItem.updatedAt
    );
  }

  async update(
    id: string,
    data: {
      name?: string;
      price?: number;
      status?: boolean;
      isExtra?: boolean;
      categoryId?: string;
      userId?: string;
    }
  ): Promise<MenuItem> {
    const updateData: any = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.price !== undefined) updateData.price = data.price;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.isExtra !== undefined) updateData.isExtra = data.isExtra;
    if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
    if (data.userId !== undefined) updateData.userId = data.userId;

    const menuItem = await this.prisma.menuItem.update({
      where: { id },
      data: updateData,
    });

    return new MenuItem(
      menuItem.id,
      menuItem.name,
      Number(menuItem.price),
      Boolean(menuItem.status),
      Boolean(menuItem.isExtra), // Asegurar conversión explícita a boolean
      menuItem.categoryId,
      menuItem.userId,
      menuItem.createdAt,
      menuItem.updatedAt
    );
  }

  async delete(id: string): Promise<void> {
    await this.prisma.menuItem.delete({
      where: { id },
    });
  }
}

