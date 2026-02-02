import { PrismaClient, ExpenseType, UnitOfMeasure } from '@prisma/client';
import { injectable } from 'tsyringe';
import {
  IExpenseRepository,
  ExpenseFilters,
  ExpenseItemInput,
  ExpenseWithUser,
} from '../../../domain/interfaces/expense-repository.interface';
import { Expense } from '../../../domain/entities/expense.entity';
import { ExpenseItem } from '../../../domain/entities/expense-item.entity';

@injectable()
export class ExpenseRepository implements IExpenseRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Expense | null> {
    const expense = await this.prisma.expense.findUnique({
      where: { id },
    });

    if (!expense) {
      return null;
    }

    return Expense.fromPrisma(expense);
  }

  async findAll(
    filters?: ExpenseFilters,
    pagination?: { skip?: number; take?: number }
  ): Promise<Expense[]> {
    const where: any = {};

    if (filters?.type) {
      where.type = filters.type;
    }

    if (filters?.userId) {
      where.userId = filters.userId;
    }

    if (filters?.paymentMethod) {
      where.paymentMethod = filters.paymentMethod;
    }

    if (filters?.dateFrom || filters?.dateTo) {
      where.date = {};
      if (filters.dateFrom) {
        where.date.gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        where.date.lte = filters.dateTo;
      }
    }

    const expenses = await this.prisma.expense.findMany({
      where,
      orderBy: {
        date: 'desc',
      },
      skip: pagination?.skip,
      take: pagination?.take,
    });

    return expenses.map((expense) => Expense.fromPrisma(expense));
  }

  async findAllWithUser(
    filters?: ExpenseFilters,
    pagination?: { skip?: number; take?: number }
  ): Promise<ExpenseWithUser[]> {
    const where: any = {};

    if (filters?.type) {
      where.type = filters.type;
    }

    if (filters?.userId) {
      where.userId = filters.userId;
    }

    if (filters?.paymentMethod) {
      where.paymentMethod = filters.paymentMethod;
    }

    if (filters?.dateFrom || filters?.dateTo) {
      where.date = {};
      if (filters.dateFrom) {
        where.date.gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        where.date.lte = filters.dateTo;
      }
    }

    const expenses = await this.prisma.expense.findMany({
      where,
      orderBy: { date: 'desc' },
      skip: pagination?.skip,
      take: pagination?.take,
      include: {
        user: {
          select: {
            name: true,
            last_name: true,
            second_last_name: true,
          },
        },
      },
    });

    return expenses.map((expense) => ({
      id: expense.id,
      title: expense.title,
      type: expense.type,
      date: expense.date,
      total: Number(expense.total),
      subtotal: Number(expense.subtotal),
      iva: Number(expense.iva),
      description: expense.description,
      paymentMethod: expense.paymentMethod,
      userId: expense.userId,
      createdAt: expense.createdAt,
      updatedAt: expense.updatedAt,
      user: {
        name: expense.user.name,
        last_name: expense.user.last_name,
        second_last_name: expense.user.second_last_name,
      },
    }));
  }

  async count(filters?: ExpenseFilters): Promise<number> {
    const where: any = {};

    if (filters?.type) {
      where.type = filters.type;
    }

    if (filters?.userId) {
      where.userId = filters.userId;
    }

    if (filters?.paymentMethod) {
      where.paymentMethod = filters.paymentMethod;
    }

    if (filters?.dateFrom || filters?.dateTo) {
      where.date = {};
      if (filters.dateFrom) {
        where.date.gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        where.date.lte = filters.dateTo;
      }
    }

    return await this.prisma.expense.count({ where });
  }

  async create(data: {
    title: string;
    type: ExpenseType;
    date: Date;
    total: number;
    subtotal: number;
    iva: number;
    description?: string | null;
    paymentMethod: number;
    userId: string;
  }): Promise<Expense> {
    const expense = await this.prisma.expense.create({
      data: {
        title: data.title,
        type: data.type,
        date: data.date,
        total: data.total,
        subtotal: data.subtotal,
        iva: data.iva,
        description: data.description || null,
        paymentMethod: data.paymentMethod,
        userId: data.userId,
      },
    });

    return Expense.fromPrisma(expense);
  }

  async createWithItems(data: {
    title: string;
    type: ExpenseType;
    date: Date;
    total: number;
    subtotal: number;
    iva: number;
    description?: string | null;
    paymentMethod: number;
    userId: string;
    items: ExpenseItemInput[];
  }): Promise<{ expense: Expense; items: ExpenseItem[] }> {
    // Use transaction to ensure atomicity
    const result = await this.prisma.$transaction(async (tx) => {
      // Create expense
      const expense = await tx.expense.create({
        data: {
          title: data.title,
          type: data.type,
          date: data.date,
          total: data.total,
          subtotal: data.subtotal,
          iva: data.iva,
          description: data.description || null,
          paymentMethod: data.paymentMethod,
          userId: data.userId,
        },
      });

      // Create all items (only if type is MERCHANDISE)
      const items =
        data.type === ExpenseType.MERCHANDISE && data.items.length > 0
          ? await Promise.all(
              data.items.map((item) =>
                tx.expenseItem.create({
                  data: {
                    expenseId: expense.id,
                    productId: item.productId,
                    amount: item.amount,
                    subtotal: item.subtotal,
                    total: item.total,
                    unitOfMeasure: (item.unitOfMeasure || null) as UnitOfMeasure | null,
                  },
                })
              )
            )
          : [];

      return { expense, items };
    });

    return {
      expense: Expense.fromPrisma(result.expense),
      items: result.items.map((item) => ExpenseItem.fromPrisma(item)),
    };
  }

  async update(
    id: string,
    data: {
      title?: string;
      date?: Date;
      total?: number;
      subtotal?: number;
      iva?: number;
      description?: string | null;
      paymentMethod?: number;
    }
  ): Promise<Expense> {
    const updateData: any = {};

    if (data.title !== undefined) updateData.title = data.title;
    if (data.date !== undefined) updateData.date = data.date;
    if (data.total !== undefined) updateData.total = data.total;
    if (data.subtotal !== undefined) updateData.subtotal = data.subtotal;
    if (data.iva !== undefined) updateData.iva = data.iva;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.paymentMethod !== undefined) updateData.paymentMethod = data.paymentMethod;

    const expense = await this.prisma.expense.update({
      where: { id },
      data: updateData,
    });

    return Expense.fromPrisma(expense);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.expense.delete({
      where: { id },
    });
  }

  // Items methods (only for MERCHANDISE type)
  async createItem(data: {
    expenseId: string;
    productId: string;
    amount: number;
    subtotal: number;
    total: number;
    unitOfMeasure?: string | null;
  }): Promise<ExpenseItem> {
    const item = await this.prisma.expenseItem.create({
      data: {
        expenseId: data.expenseId,
        productId: data.productId,
        amount: data.amount,
        subtotal: data.subtotal,
        total: data.total,
        unitOfMeasure: (data.unitOfMeasure || null) as UnitOfMeasure | null,
      },
    });

    return ExpenseItem.fromPrisma(item);
  }

  async findItemsByExpenseId(expenseId: string): Promise<ExpenseItem[]> {
    const items = await this.prisma.expenseItem.findMany({
      where: { expenseId },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return items.map((item) => ExpenseItem.fromPrisma(item));
  }

  async updateItem(
    id: string,
    data: {
      amount?: number;
      subtotal?: number;
      total?: number;
      unitOfMeasure?: string | null;
    }
  ): Promise<ExpenseItem> {
    const updateData: any = {};

    if (data.amount !== undefined) updateData.amount = data.amount;
    if (data.subtotal !== undefined) updateData.subtotal = data.subtotal;
    if (data.total !== undefined) updateData.total = data.total;
    if (data.unitOfMeasure !== undefined) updateData.unitOfMeasure = data.unitOfMeasure;

    const item = await this.prisma.expenseItem.update({
      where: { id },
      data: updateData,
    });

    return ExpenseItem.fromPrisma(item);
  }

  async deleteItem(id: string): Promise<void> {
    await this.prisma.expenseItem.delete({
      where: { id },
    });
  }

  async deleteItemsByExpenseId(expenseId: string): Promise<void> {
    await this.prisma.expenseItem.deleteMany({
      where: { expenseId },
    });
  }
}

