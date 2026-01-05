import { ExpenseType } from '@prisma/client';
import { Expense } from '../entities/expense.entity';
import { ExpenseItem } from '../entities/expense-item.entity';

export interface ExpenseFilters {
  type?: ExpenseType;
  userId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  paymentMethod?: number;
}

export interface ExpenseItemInput {
  productId: string;
  amount: number;
  subtotal: number;
  total: number;
  unitOfMeasure?: string | null;
}

export interface IExpenseRepository {
  findById(id: string): Promise<Expense | null>;
  findAll(
    filters?: ExpenseFilters,
    pagination?: { skip?: number; take?: number }
  ): Promise<Expense[]>;
  count(filters?: ExpenseFilters): Promise<number>;
  create(data: {
    type: ExpenseType;
    date: Date;
    total: number;
    subtotal: number;
    iva: number;
    description?: string | null;
    paymentMethod: number;
    userId: string;
  }): Promise<Expense>;
  createWithItems(data: {
    type: ExpenseType;
    date: Date;
    total: number;
    subtotal: number;
    iva: number;
    description?: string | null;
    paymentMethod: number;
    userId: string;
    items: ExpenseItemInput[];
  }): Promise<{ expense: Expense; items: ExpenseItem[] }>;
  update(
    id: string,
    data: {
      date?: Date;
      total?: number;
      subtotal?: number;
      iva?: number;
      description?: string | null;
      paymentMethod?: number;
    }
  ): Promise<Expense>;
  delete(id: string): Promise<void>;

  // Items methods (only for MERCHANDISE type)
  createItem(data: {
    expenseId: string;
    productId: string;
    amount: number;
    subtotal: number;
    total: number;
    unitOfMeasure?: string | null;
  }): Promise<ExpenseItem>;
  findItemsByExpenseId(expenseId: string): Promise<ExpenseItem[]>;
  updateItem(
    id: string,
    data: {
      amount?: number;
      subtotal?: number;
      total?: number;
      unitOfMeasure?: string | null;
    }
  ): Promise<ExpenseItem>;
  deleteItem(id: string): Promise<void>;
  deleteItemsByExpenseId(expenseId: string): Promise<void>;
}

