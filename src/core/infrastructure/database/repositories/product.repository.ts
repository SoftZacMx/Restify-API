import { PrismaClient } from '@prisma/client';
import { IProductRepository, ProductFilters } from '../../../domain/interfaces/product-repository.interface';
import { Product } from '../../../domain/entities/product.entity';

export class ProductRepository implements IProductRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Product | null> {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      return null;
    }

    return new Product(
      product.id,
      product.name,
      product.description,
      product.registrationDate,
      product.status,
      product.userId,
      product.createdAt,
      product.updatedAt
    );
  }

  async findByIds(ids: string[]): Promise<Product[]> {
    const products = await this.prisma.product.findMany({
      where: {
        id: {
          in: ids,
        },
      },
    });

    return products.map(
      (product) =>
        new Product(
          product.id,
          product.name,
          product.description,
          product.registrationDate,
          product.status,
          product.userId,
          product.createdAt,
          product.updatedAt
        )
    );
  }

  async findAll(filters?: ProductFilters): Promise<Product[]> {
    const where: any = {};

    if (filters?.status !== undefined) {
      where.status = filters.status;
    }

    if (filters?.userId) {
      where.userId = filters.userId;
    }

    if (filters?.search) {
      where.name = {
        contains: filters.search,
      };
    }

    const products = await this.prisma.product.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return products.map(
      (product) =>
        new Product(
          product.id,
          product.name,
          product.description,
          product.registrationDate,
          product.status,
          product.userId,
          product.createdAt,
          product.updatedAt
        )
    );
  }

  async create(data: {
    name: string;
    description: string | null;
    status: boolean;
    userId: string;
  }): Promise<Product> {
    const product = await this.prisma.product.create({
      data: {
        name: data.name,
        description: data.description,
        status: data.status,
        userId: data.userId,
      },
    });

    return new Product(
      product.id,
      product.name,
      product.description,
      product.registrationDate,
      product.status,
      product.userId,
      product.createdAt,
      product.updatedAt
    );
  }

  async update(
    id: string,
    data: {
      name?: string;
      description?: string | null;
      status?: boolean;
    }
  ): Promise<Product> {
    const updateData: any = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.status !== undefined) updateData.status = data.status;

    const product = await this.prisma.product.update({
      where: { id },
      data: updateData,
    });

    return new Product(
      product.id,
      product.name,
      product.description,
      product.registrationDate,
      product.status,
      product.userId,
      product.createdAt,
      product.updatedAt
    );
  }

  async delete(id: string): Promise<void> {
    await this.prisma.product.delete({
      where: { id },
    });
  }
}

