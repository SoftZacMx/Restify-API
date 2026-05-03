import { inject, injectable } from 'tsyringe';
import { Prisma, PrismaClient, StockMovement, StockMovementType, UnitOfMeasure } from '@prisma/client';
import { PrismaService } from '../../infrastructure/config/prisma.config';
import { AppError } from '../../../shared/errors';
import { convertQuantity } from '../../../shared/utils/unit-conversion.util';

const Decimal = Prisma.Decimal;
type DecimalLike = Prisma.Decimal | number | string;

export type WasteReason = 'EXPIRED' | 'BROKEN' | 'THEFT' | 'OTHER';
export const WASTE_REASONS: WasteReason[] = ['EXPIRED', 'BROKEN', 'THEFT', 'OTHER'];

export interface RecordPurchaseInput {
  productId: string;
  quantity: DecimalLike;
  unitCost: DecimalLike;
  expenseItemId?: string | null;
  userId: string;
  notes?: string | null;
}

export interface RecordWasteInput {
  productId: string;
  quantity: DecimalLike;
  reason: WasteReason;
  userId: string;
  notes?: string | null;
}

export interface RecordAdjustmentInput {
  productId: string;
  newStock: DecimalLike;
  reason: string;
  userId: string;
  notes?: string | null;
}

export interface RecordPurchaseReversalInput {
  expenseItemId: string;
  reason: string;
  userId: string;
  notes?: string | null;
}

export interface StockSummaryFilters {
  search?: string;
  lowStockOnly?: boolean;
  onlyTracked?: boolean;
}

export interface StockSummary {
  productId: string;
  name: string;
  description: string | null;
  unitOfMeasure: UnitOfMeasure | null;
  stockActual: Prisma.Decimal;
  averageCost: Prisma.Decimal;
  minStockAlert: Prisma.Decimal | null;
  trackStock: boolean;
  isLowStock: boolean;
}

export interface MovementsFilters {
  productId?: string;
  type?: StockMovementType;
  reason?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Único punto del código que muta `products.stockActual` y escribe en `stock_movements`.
 *
 * Invariante: `products.stockActual = sum(stock_movements.quantity WHERE productId = X)`.
 *
 * Reglas globales:
 * - Toda mutación corre dentro de una transacción atómica (movement + update de stock).
 * - Productos con `trackStock=false` son no-op silenciosos en mermas/ajustes/ventas. En
 *   compras igual se actualiza `averageCost` para que esté listo cuando se active el track.
 * - Stock negativo está permitido (se logguea como warning) — un restaurante a veces vende
 *   antes de cargar la compra. La reconciliación llega vía ajuste manual.
 * - Las reversiones son idempotentes: cancelar dos veces la misma orden no duplica.
 */
@injectable()
export class StockService {
  private readonly prisma: PrismaClient;

  constructor(@inject(PrismaService) prismaService: PrismaService) {
    this.prisma = prismaService.getClient();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Entradas
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Registra una compra. Suma stock y recalcula `averageCost` (promedio ponderado).
   * Devuelve `null` si el producto no trackea stock (igual actualiza el costo promedio).
   *
   * Si se pasa `tx`, corre dentro de esa transacción (para componer con otras operaciones,
   * ej. creación de Expense + items). Si no, abre su propia transacción.
   */
  async recordPurchase(
    input: RecordPurchaseInput,
    tx?: Prisma.TransactionClient
  ): Promise<StockMovement | null> {
    const quantity = new Decimal(input.quantity);
    const unitCost = new Decimal(input.unitCost);

    if (quantity.lessThanOrEqualTo(0)) {
      throw new AppError('STOCK_INVALID_QUANTITY', 'quantity must be positive for purchases');
    }
    if (unitCost.lessThan(0)) {
      throw new AppError('VALIDATION_ERROR', 'unitCost cannot be negative');
    }

    const run = async (client: Prisma.TransactionClient): Promise<StockMovement | null> => {
      const product = await client.product.findUnique({ where: { id: input.productId } });
      if (!product) {
        throw new AppError('PRODUCT_NOT_FOUND', `Product ${input.productId} not found`);
      }

      const newStock = product.stockActual.plus(quantity);
      const newAverageCost = newStock.equals(0)
        ? unitCost
        : product.stockActual
            .times(product.averageCost)
            .plus(quantity.times(unitCost))
            .dividedBy(newStock);

      if (!product.trackStock) {
        // No genera movement ni mueve stock, pero deja el costo listo para cuando se active.
        await client.product.update({
          where: { id: input.productId },
          data: { averageCost: newAverageCost },
        });
        return null;
      }

      const movement = await client.stockMovement.create({
        data: {
          productId: input.productId,
          quantity,
          type: StockMovementType.PURCHASE,
          expenseItemId: input.expenseItemId ?? null,
          userId: input.userId,
          notes: input.notes ?? null,
        },
      });

      await client.product.update({
        where: { id: input.productId },
        data: {
          stockActual: newStock,
          averageCost: newAverageCost,
        },
      });

      return movement;
    };

    return tx ? run(tx) : this.prisma.$transaction(run);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Salidas por venta
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Registra la salida de stock para un OrderItem ya creado. Resuelve si el MenuItem
   * tiene receta (descuenta cada ingrediente) o es item directo (descuenta una unidad
   * del producto vinculado). Si no aplica, devuelve array vacío sin error.
   *
   * Si se pasa `tx`, corre dentro de esa transacción (para componer con la creación
   * de la orden). Si no, abre su propia transacción.
   */
  async recordSaleForOrderItem(
    orderItemId: string,
    userId: string | null,
    tx?: Prisma.TransactionClient
  ): Promise<StockMovement[]> {
    const run = async (client: Prisma.TransactionClient): Promise<StockMovement[]> => {
      const orderItem = await client.orderItem.findUnique({
        where: { id: orderItemId },
        include: {
          menuItem: {
            include: { ingredients: true },
          },
          extras: {
            include: {
              extra: {
                include: { ingredients: true },
              },
            },
          },
        },
      });

      if (!orderItem) {
        throw new AppError('ORDER_ITEM_NOT_FOUND', `OrderItem ${orderItemId} not found`);
      }

      const movements: StockMovement[] = [];

      // 1. Descontar lo del MenuItem principal.
      const sold = new Decimal(orderItem.quantity);
      if (orderItem.menuItem) {
        const main = await this.discountForMenuItem(client, {
          menuItem: orderItem.menuItem,
          quantity: sold,
          orderItemId,
          userId,
        });
        movements.push(...main);
      } else if (orderItem.productId) {
        // OrderItem sin menuItem pero con productId directo (caso histórico).
        const direct = await this.discountDirectProduct(client, {
          productId: orderItem.productId,
          quantity: sold,
          orderItemId,
          userId,
        });
        if (direct) movements.push(direct);
      }

      // 2. Descontar lo de cada extra. La cantidad de cada extra es absoluta
      //    (consistente con el cálculo del precio: extra.price * extra.quantity).
      for (const oie of orderItem.extras) {
        const extraQty = new Decimal(oie.quantity);
        const extraMovements = await this.discountForMenuItem(client, {
          menuItem: oie.extra,
          quantity: extraQty,
          orderItemId, // los movements del extra se linkean al orderItem padre para reversal idempotente
          userId,
        });
        movements.push(...extraMovements);
      }

      return movements;
    };

    return tx ? run(tx) : this.prisma.$transaction(run);
  }

  /**
   * Descuenta el stock correspondiente a un MenuItem (con receta o producto directo).
   * Si tiene `ingredients`, descuenta cada uno; si no pero tiene `productId`, descuenta
   * 1 unidad del producto por cada `quantity`. Si nada aplica, devuelve [].
   */
  private async discountForMenuItem(
    client: Prisma.TransactionClient,
    params: {
      menuItem: {
        productId: string | null;
        ingredients: { productId: string; quantity: Prisma.Decimal; unit: UnitOfMeasure | null }[];
      };
      quantity: Prisma.Decimal;
      orderItemId: string;
      userId: string | null;
    }
  ): Promise<StockMovement[]> {
    const movements: StockMovement[] = [];

    // Caso A — MenuItem con receta.
    if (params.menuItem.ingredients.length > 0) {
      for (const ing of params.menuItem.ingredients) {
        const product = await client.product.findUnique({ where: { id: ing.productId } });
        if (!product || !product.trackStock) continue;

        const ingUnit = ing.unit ?? product.unitOfMeasure;
        const qtyInProductUnit = convertQuantity(ing.quantity, ingUnit, product.unitOfMeasure);
        const movementQty = qtyInProductUnit.times(params.quantity).negated();

        const movement = await client.stockMovement.create({
          data: {
            productId: ing.productId,
            quantity: movementQty,
            type: StockMovementType.SALE,
            orderItemId: params.orderItemId,
            userId: params.userId,
          },
        });

        await client.product.update({
          where: { id: ing.productId },
          data: { stockActual: { increment: movementQty } },
        });

        this.warnIfNegative(product.stockActual.plus(movementQty), ing.productId);
        movements.push(movement);
      }
      return movements;
    }

    // Caso B — MenuItem directo (vinculado a un Product 1:1).
    if (params.menuItem.productId) {
      const direct = await this.discountDirectProduct(client, {
        productId: params.menuItem.productId,
        quantity: params.quantity,
        orderItemId: params.orderItemId,
        userId: params.userId,
      });
      if (direct) movements.push(direct);
    }

    // Caso C — sin receta ni productId: no genera movements (silencioso).
    return movements;
  }

  /** Descuenta `quantity` unidades del producto y registra el SALE. Devuelve null si trackStock=false. */
  private async discountDirectProduct(
    client: Prisma.TransactionClient,
    params: {
      productId: string;
      quantity: Prisma.Decimal;
      orderItemId: string;
      userId: string | null;
    }
  ): Promise<StockMovement | null> {
    const product = await client.product.findUnique({ where: { id: params.productId } });
    if (!product || !product.trackStock) return null;

    const movementQty = params.quantity.negated();

    const movement = await client.stockMovement.create({
      data: {
        productId: params.productId,
        quantity: movementQty,
        type: StockMovementType.SALE,
        orderItemId: params.orderItemId,
        userId: params.userId,
      },
    });

    await client.product.update({
      where: { id: params.productId },
      data: { stockActual: { increment: movementQty } },
    });

    this.warnIfNegative(product.stockActual.plus(movementQty), params.productId);
    return movement;
  }

  /**
   * Revierte la(s) venta(s) asociadas a un OrderItem. Idempotente: si ya existe un
   * SALE_REVERSAL para ese orderItemId, no crea nada y devuelve array vacío.
   *
   * Si se pasa `tx`, corre dentro de esa transacción.
   */
  async reverseSaleForOrderItem(
    orderItemId: string,
    userId: string | null,
    reason: string,
    tx?: Prisma.TransactionClient
  ): Promise<StockMovement[]> {
    const run = async (client: Prisma.TransactionClient): Promise<StockMovement[]> => {
      const existing = await client.stockMovement.findFirst({
        where: { orderItemId, type: StockMovementType.SALE_REVERSAL },
      });
      if (existing) return [];

      const sales = await client.stockMovement.findMany({
        where: { orderItemId, type: StockMovementType.SALE },
      });
      if (sales.length === 0) return [];

      const reversals: StockMovement[] = [];
      for (const sale of sales) {
        const reverseQty = sale.quantity.negated();

        const reversal = await client.stockMovement.create({
          data: {
            productId: sale.productId,
            quantity: reverseQty,
            type: StockMovementType.SALE_REVERSAL,
            orderItemId,
            userId,
            reason,
          },
        });

        await client.product.update({
          where: { id: sale.productId },
          data: { stockActual: { increment: reverseQty } },
        });

        reversals.push(reversal);
      }
      return reversals;
    };

    return tx ? run(tx) : this.prisma.$transaction(run);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Reversa de compra (edición / eliminación de Expense — Fase 3.2)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Genera un movement compensatorio (`type=ADJUSTMENT`) que revierte una compra
   * previa identificada por `expenseItemId`. Idempotente: si ya existe una
   * compensación para ese expenseItem, devuelve null.
   *
   * El movement original PURCHASE queda intacto como historial. Si después se
   * borra el ExpenseItem (cascade desde Expense), su FK queda en null en ambos
   * movements (el original y el compensatorio) — el ledger preserva la auditoría.
   *
   * NO recalcula `averageCost`: el promedio ponderado es matemáticamente
   * irreversible sin el historial completo de compras. Se acepta drift en
   * casos de borrado, mitigado por nuevas compras que reponderan el promedio.
   */
  async recordPurchaseReversal(
    input: RecordPurchaseReversalInput,
    tx?: Prisma.TransactionClient
  ): Promise<StockMovement | null> {
    if (!input.reason || input.reason.trim().length === 0) {
      throw new AppError('STOCK_REASON_REQUIRED', 'reason is required for purchase reversal');
    }

    const run = async (client: Prisma.TransactionClient): Promise<StockMovement | null> => {
      // Idempotencia: si ya hay un ADJUSTMENT compensatorio para este expenseItem, salir.
      const existing = await client.stockMovement.findFirst({
        where: {
          expenseItemId: input.expenseItemId,
          type: StockMovementType.ADJUSTMENT,
        },
      });
      if (existing) return null;

      const original = await client.stockMovement.findFirst({
        where: {
          expenseItemId: input.expenseItemId,
          type: StockMovementType.PURCHASE,
        },
      });
      // No hay PURCHASE original (el producto tenía trackStock=false al comprar): no-op.
      if (!original) return null;

      const reverseQty = original.quantity.negated();

      const adjustment = await client.stockMovement.create({
        data: {
          productId: original.productId,
          quantity: reverseQty,
          type: StockMovementType.ADJUSTMENT,
          reason: input.reason,
          notes: input.notes ?? null,
          expenseItemId: input.expenseItemId,
          userId: input.userId,
        },
      });

      await client.product.update({
        where: { id: original.productId },
        data: { stockActual: { increment: reverseQty } },
      });

      return adjustment;
    };

    return tx ? run(tx) : this.prisma.$transaction(run);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Salidas / correcciones manuales
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Registra una merma con motivo. No-op si el producto no trackea stock.
   */
  async recordWaste(input: RecordWasteInput): Promise<StockMovement | null> {
    const quantity = new Decimal(input.quantity);

    if (quantity.lessThanOrEqualTo(0)) {
      throw new AppError('STOCK_INVALID_QUANTITY', 'quantity must be positive for waste');
    }
    if (!input.reason) {
      throw new AppError('STOCK_REASON_REQUIRED', 'reason is required for waste');
    }
    if (!WASTE_REASONS.includes(input.reason)) {
      throw new AppError('VALIDATION_ERROR', `invalid waste reason: ${input.reason}`);
    }

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: input.productId } });
      if (!product) {
        throw new AppError('PRODUCT_NOT_FOUND', `Product ${input.productId} not found`);
      }
      if (!product.trackStock) return null;

      const movementQty = quantity.negated();

      const movement = await tx.stockMovement.create({
        data: {
          productId: input.productId,
          quantity: movementQty,
          type: StockMovementType.WASTE,
          reason: input.reason,
          notes: input.notes ?? null,
          userId: input.userId,
        },
      });

      await tx.product.update({
        where: { id: input.productId },
        data: { stockActual: { increment: movementQty } },
      });

      this.warnIfNegative(product.stockActual.plus(movementQty), input.productId);
      return movement;
    });
  }

  /**
   * Ajuste por conteo físico: setea el stock a un valor absoluto.
   * El `quantity` del movement es la diferencia (`newStock - stockActual`),
   * preservando la invariante stock = sum(movements).
   */
  async recordAdjustment(input: RecordAdjustmentInput): Promise<StockMovement | null> {
    const newStock = new Decimal(input.newStock);

    if (newStock.lessThan(0)) {
      throw new AppError('VALIDATION_ERROR', 'newStock cannot be negative');
    }
    if (!input.reason || input.reason.trim().length === 0) {
      throw new AppError('STOCK_REASON_REQUIRED', 'reason is required for adjustment');
    }

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: input.productId } });
      if (!product) {
        throw new AppError('PRODUCT_NOT_FOUND', `Product ${input.productId} not found`);
      }
      if (!product.trackStock) return null;

      const diff = newStock.minus(product.stockActual);
      if (diff.equals(0)) return null;

      const movement = await tx.stockMovement.create({
        data: {
          productId: input.productId,
          quantity: diff,
          type: StockMovementType.ADJUSTMENT,
          reason: input.reason,
          notes: input.notes ?? null,
          userId: input.userId,
        },
      });

      await tx.product.update({
        where: { id: input.productId },
        data: { stockActual: newStock },
      });

      return movement;
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Lecturas
  // ──────────────────────────────────────────────────────────────────────────

  async getStockSummary(filters: StockSummaryFilters = {}): Promise<StockSummary[]> {
    const where: Prisma.ProductWhereInput = {};
    if (filters.onlyTracked !== false) where.trackStock = true;
    if (filters.search) where.name = { contains: filters.search };

    const products = await this.prisma.product.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    return products
      .filter((p) => {
        if (!filters.lowStockOnly) return true;
        if (!p.minStockAlert) return false;
        return p.stockActual.lessThanOrEqualTo(p.minStockAlert);
      })
      .map((p) => ({
        productId: p.id,
        name: p.name,
        description: p.description,
        unitOfMeasure: p.unitOfMeasure,
        stockActual: p.stockActual,
        averageCost: p.averageCost,
        minStockAlert: p.minStockAlert,
        trackStock: p.trackStock,
        isLowStock: p.minStockAlert ? p.stockActual.lessThanOrEqualTo(p.minStockAlert) : false,
      }));
  }

  /**
   * Configura los campos de stock de un producto: si lo trackea, su unidad y la alerta de mínimo.
   * No mueve stock — sólo actualiza la metadata.
   */
  async updateStockConfig(
    productId: string,
    config: { trackStock?: boolean; unitOfMeasure?: UnitOfMeasure | null; minStockAlert?: Prisma.Decimal | number | null }
  ): Promise<void> {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new AppError('PRODUCT_NOT_FOUND', `Product ${productId} not found`);
    }

    const data: Prisma.ProductUpdateInput = {};
    if (config.trackStock !== undefined) data.trackStock = config.trackStock;
    if (config.unitOfMeasure !== undefined) data.unitOfMeasure = config.unitOfMeasure;
    if (config.minStockAlert !== undefined) {
      data.minStockAlert = config.minStockAlert === null ? null : new Decimal(config.minStockAlert);
    }

    await this.prisma.product.update({ where: { id: productId }, data });
  }

  async getMovements(filters: MovementsFilters = {}): Promise<StockMovement[]> {
    const where: Prisma.StockMovementWhereInput = {};
    if (filters.productId) where.productId = filters.productId;
    if (filters.type) where.type = filters.type;
    if (filters.reason) where.reason = filters.reason;
    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) where.createdAt.gte = filters.from;
      if (filters.to) where.createdAt.lte = filters.to;
    }

    return this.prisma.stockMovement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filters.limit ?? 100,
      skip: filters.offset ?? 0,
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Internos
  // ──────────────────────────────────────────────────────────────────────────

  private warnIfNegative(updatedStock: Prisma.Decimal, productId: string): void {
    if (updatedStock.lessThan(0)) {
      console.warn(
        `[StockService] Stock negativo permitido para product ${productId}: ${updatedStock.toString()}`
      );
    }
  }
}
