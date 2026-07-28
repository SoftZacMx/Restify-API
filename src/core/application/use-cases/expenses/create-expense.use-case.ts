import { inject, injectable } from 'tsyringe';
import { IExpenseRepository } from '../../../domain/interfaces/expense-repository.interface';
import { IProductRepository } from '../../../domain/interfaces/product-repository.interface';
import { CreateExpenseInput } from '../../dto/expense.dto';
import { AppError } from '../../../../shared/errors';
import { ExpenseType, type UnitOfMeasure } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/config/prisma.config';
import { StockService } from '../../services/stock.service';
import { BranchTimezoneService } from '../../services/branch-timezone.service';
import { startOfDayInZone } from '../../../../shared/utils/date-range.util';

export interface CreateExpenseResult {
  expense: {
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
    @inject('IProductRepository') private readonly productRepository: IProductRepository,
    @inject(PrismaService) private readonly prismaService: PrismaService,
    @inject(StockService) private readonly stockService: StockService,
    @inject(BranchTimezoneService) private readonly branchTimezoneService: BranchTimezoneService
  ) {}

  async execute(input: CreateExpenseInput): Promise<CreateExpenseResult> {
    const timezone = await this.branchTimezoneService.get();

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

      // Create expense + items y registrar movimientos de stock en una sola transacción.
      // Si recordPurchase falla para cualquier item, todo revierte (no quedan items huérfanos
      // sin movement ni stock desactualizado).
      const prisma = this.prismaService.getClient();
      const result = await prisma.$transaction(async (tx) => {
        const created = await this.expenseRepository.createWithItems(
          {
            title: input.title,
            type: input.type,
            date: input.date ? startOfDayInZone(input.date, timezone) : new Date(),
            total: input.total,
            subtotal: input.subtotal,
            iva: input.iva,
            description: input.description || null,
            paymentMethod: input.paymentMethod,
            userId: input.userId,
            items: input.items!.map((item) => ({
              productId: item.productId,
              amount: item.amount,
              subtotal: item.subtotal,
              total: item.total,
              unitOfMeasure: item.unitOfMeasure || null,
            })),
          },
          tx
        );

        for (const item of created.items) {
          // unitCost = subtotal del renglón / cantidad. Validamos amount > 0 antes (zod).
          const unitCost = item.subtotal / item.amount;
          // Si el item declara una unidad distinta a la del producto, StockService convierte
          // tanto cantidad como costo unitario antes de persistir (preserva el total).
          await this.stockService.recordPurchase(
            {
              productId: item.productId,
              quantity: item.amount,
              unitCost,
              unitOfMeasure: item.unitOfMeasure as UnitOfMeasure | null | undefined,
              expenseItemId: item.id,
              userId: input.userId,
            },
            tx
          );
        }

        return created;
      });

      return {
        expense: {
          id: result.expense.id,
          title: result.expense.title,
          type: result.expense.type,
          date: result.expense.date,
          total: result.expense.total,
          subtotal: result.expense.subtotal,
          iva: result.expense.iva,
          description: result.expense.description,
          paymentMethod: result.expense.paymentMethod,
          userId: result.expense.userId,
          paymentId: result.expense.paymentId,
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
        title: input.title,
        type: input.type,
        date: input.date ? startOfDayInZone(input.date, timezone) : new Date(),
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
          title: expense.title,
          type: expense.type,
          date: expense.date,
          total: expense.total,
          subtotal: expense.subtotal,
          iva: expense.iva,
          description: expense.description,
          paymentMethod: expense.paymentMethod,
          userId: expense.userId,
          paymentId: expense.paymentId,
          createdAt: expense.createdAt,
        },
      };
    }
  }
}

