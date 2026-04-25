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

/** Resultado de gasto con usuario (join) para listado */
export interface ExpenseWithUser {
  id: string;
  title: string;
  type: ExpenseType;
  date: Date;
  total: number;
  subtotal: number;
  iva: number;
  description: string | null;
  paymentMethod: number;
  userId: string | null;
  paymentId: string | null;
  createdAt: Date;
  updatedAt: Date;
  /** null cuando el gasto fue creado por el sistema (sin usuario asociado). */
  user: {
    name: string;
    last_name: string;
    second_last_name: string | null;
  } | null;
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
  /** Busca un gasto por el paymentId (idempotencia para gastos derivados de un Payment). */
  findByPaymentId(paymentId: string): Promise<Expense | null>;
  findAll(
    filters?: ExpenseFilters,
    pagination?: { skip?: number; take?: number }
  ): Promise<Expense[]>;
  findAllWithUser(
    filters?: ExpenseFilters,
    pagination?: { skip?: number; take?: number }
  ): Promise<ExpenseWithUser[]>;
  count(filters?: ExpenseFilters): Promise<number>;
  create(data: {
    title: string;
    type: ExpenseType;
    date: Date;
    total: number;
    subtotal: number;
    iva: number;
    description?: string | null;
    paymentMethod: number;
    userId: string | null;
    paymentId?: string | null;
  }): Promise<Expense>;
  createWithItems(data: {
    title: string;
    type: ExpenseType;
    date: Date;
    total: number;
    subtotal: number;
    iva: number;
    description?: string | null;
    paymentMethod: number;
    userId: string | null;
    items: ExpenseItemInput[];
  }): Promise<{ expense: Expense; items: ExpenseItem[] }>;
  update(
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

