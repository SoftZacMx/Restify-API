import { PrismaClient } from '@prisma/client';
import { ITableRepository, TableFilters } from '../../../domain/interfaces/table-repository.interface';
import { Table } from '../../../domain/entities/table.entity';

export class TableRepository implements ITableRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Table | null> {
    const table = await this.prisma.table.findUnique({
      where: { id },
    });

    if (!table) {
      return null;
    }

    return new Table(
      table.id,
      table.name,
      table.userId,
      table.status,
      table.availabilityStatus,
      table.createdAt,
      table.updatedAt
    );
  }

  async findByName(name: string): Promise<Table | null> {
    const table = await this.prisma.table.findUnique({
      where: { name },
    });

    if (!table) {
      return null;
    }

    return new Table(
      table.id,
      table.name,
      table.userId,
      table.status,
      table.availabilityStatus,
      table.createdAt,
      table.updatedAt
    );
  }

  async findAll(filters?: TableFilters): Promise<Table[]> {
    const where: any = {};

    if (filters?.status !== undefined) {
      where.status = filters.status;
    }

    if (filters?.availabilityStatus !== undefined) {
      where.availabilityStatus = filters.availabilityStatus;
    }

    if (filters?.userId) {
      where.userId = filters.userId;
    }

    if (filters?.name !== undefined) {
      where.name = filters.name;
    }

    const tables = await this.prisma.table.findMany({
      where,
      orderBy: {
        name: 'asc',
      },
    });

    return tables.map(
      (table) =>
        new Table(
          table.id,
          table.name,
          table.userId,
          table.status,
          table.availabilityStatus,
          table.createdAt,
          table.updatedAt
        )
    );
  }

  async create(data: {
    name: string;
    status: boolean;
    availabilityStatus: boolean;
    userId: string;
  }): Promise<Table> {
    const table = await this.prisma.table.create({
      data: {
        name: data.name,
        status: data.status,
        availabilityStatus: data.availabilityStatus,
        userId: data.userId,
      },
    });

    return new Table(
      table.id,
      table.name,
      table.userId,
      table.status,
      table.availabilityStatus,
      table.createdAt,
      table.updatedAt
    );
  }

  async update(
    id: string,
    data: {
      name?: string;
      status?: boolean;
      availabilityStatus?: boolean;
    }
  ): Promise<Table> {
    const updateData: any = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.availabilityStatus !== undefined) updateData.availabilityStatus = data.availabilityStatus;

    const table = await this.prisma.table.update({
      where: { id },
      data: updateData,
    });

    return new Table(
      table.id,
      table.name,
      table.userId,
      table.status,
      table.availabilityStatus,
      table.createdAt,
      table.updatedAt
    );
  }

  async delete(id: string): Promise<void> {
    await this.prisma.table.delete({
      where: { id },
    });
  }
}
