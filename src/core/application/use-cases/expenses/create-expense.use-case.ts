import { inject, injectable } from 'tsyringe';
import { IExpenseRepository } from '../../../domain/interfaces/expense-repository.interface';
import { IProductRepository } from '../../../domain/interfaces/product-repository.interface';
import { CreateExpenseInput } from '../../dto/expense.dto';
import { AppError } from '../../../../shared/errors';
import { ExpenseType } from '@prisma/client';

export interface CreateExpenseResult {
  expense: {
    id: string;
    type: ExpenseType;
    date: Date;
    total: number;
    subtotal: number;
    iva: number;
    description: string | null;
    paymentMethod: number;
    userId: string;
    createdAt: Date;
  };
  items?: Array<{
    id: string;
    productId: string;
    amount: number;
    subtotal: number;
    total: number;
    unitOfMeasure: string | null;
  }>;
}

@injectable()
export class CreateExpenseUseCase {
  constructor(
    @inject('IExpenseRepository') private readonly expenseRepository: IExpenseRepository,
    @inject('IProductRepository') private readonly productRepository: IProductRepository
  ) {}

  async execute(input: CreateExpenseInput): Promise<CreateExpenseResult> {
    // If type is MERCHANDISE, validate products and items
    if (input.type === ExpenseType.MERCHANDISE) {
      if (!input.items || input.items.length === 0) {
        throw new AppError('VALIDATION_ERROR', 'Items are required for MERCHANDISE type expenses');
      }

      // Validate that all products exist (single query instead of N queries)
      const productIds = input.items.map((item) => item.productId);
      const uniqueProductIds = [...new Set(productIds)]; // Remove duplicates
      const products = await this.productRepository.findByIds(uniqueProductIds);

      if (products.length !== uniqueProductIds.length) {
        const foundIds = new Set(products.map((p) => p.id));
        const missingIds = uniqueProductIds.filter((id) => !foundIds.has(id));
        throw new AppError('PRODUCT_NOT_FOUND', `Products with IDs ${missingIds.join(', ')} not found`);
      }

      // Validate totals match
      const itemsSubtotal = input.items.reduce((sum, item) => sum + item.subtotal, 0);
      const itemsTotal = input.items.reduce((sum, item) => sum + item.total, 0);
      const calculatedIva = itemsTotal - itemsSubtotal;

      // Allow small rounding differences (0.01 tolerance)
      if (Math.abs(itemsSubtotal - input.subtotal) > 0.01) {
        throw new AppError(
          'SUBTOTAL_MISMATCH',
          `Items subtotal (${itemsSubtotal}) does not match expense subtotal (${input.subtotal})`
        );
      }

      if (Math.abs(calculatedIva - input.iva) > 0.01) {
        throw new AppError(
          'IVA_MISMATCH',
          `Calculated IVA (${calculatedIva}) does not match expense IVA (${input.iva})`
        );
      }

      if (Math.abs(itemsTotal - input.total) > 0.01) {
        throw new AppError(
          'TOTAL_MISMATCH',
          `Items total (${itemsTotal}) does not match expense total (${input.total})`
        );
      }

      // Create expense with items in a transaction
      const result = await this.expenseRepository.createWithItems({
        type: input.type,
        date: input.date ? new Date(input.date) : new Date(),
        total: input.total,
        subtotal: input.subtotal,
        iva: input.iva,
        description: input.description || null,
        paymentMethod: input.paymentMethod,
        userId: input.userId,
        items: input.items.map((item) => ({
          productId: item.productId,
          amount: item.amount,
          subtotal: item.subtotal,
          total: item.total,
          unitOfMeasure: item.unitOfMeasure || null,
        })),
      });

      return {
        expense: {
          id: result.expense.id,
          type: result.expense.type,
          date: result.expense.date,
          total: result.expense.total,
          subtotal: result.expense.subtotal,
          iva: result.expense.iva,
          description: result.expense.description,
          paymentMethod: result.expense.paymentMethod,
          userId: result.expense.userId,
          createdAt: result.expense.createdAt,
        },
        items: result.items.map((item) => ({
          id: item.id,
          productId: item.productId,
          amount: item.amount,
          subtotal: item.subtotal,
          total: item.total,
          unitOfMeasure: item.unitOfMeasure,
        })),
      };
    } else {
      // For non-MERCHANDISE types, items should not be provided
      if (input.items && input.items.length > 0) {
        throw new AppError('VALIDATION_ERROR', 'Items are only allowed for MERCHANDISE type expenses');
      }

      // Create expense without items
      const expense = await this.expenseRepository.create({
        type: input.type,
        date: input.date ? new Date(input.date) : new Date(),
        total: input.total,
        subtotal: input.subtotal,
        iva: input.iva,
        description: input.description || null,
        paymentMethod: input.paymentMethod,
        userId: input.userId,
      });

      return {
        expense: {
          id: expense.id,
          type: expense.type,
          date: expense.date,
          total: expense.total,
          subtotal: expense.subtotal,
          iva: expense.iva,
          description: expense.description,
          paymentMethod: expense.paymentMethod,
          userId: expense.userId,
          createdAt: expense.createdAt,
        },
      };
    }
  }
}

