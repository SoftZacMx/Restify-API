import { injectable } from 'tsyringe';
import { Prisma, Product, StockMovement, StockMovementType, UnitOfMeasure } from '@prisma/client';
import { getPrisma, TenantTransactionClient } from '../../infrastructure/database/prisma/get-prisma';
import { AppError } from '../../../shared/errors';
import { convertQuantity, unitsCompatible } from '../../../shared/utils/unit-conversion.util';

const Decimal = Prisma.Decimal;
type DecimalLike = Prisma.Decimal | number | string;

export type WasteReason = 'EXPIRED' | 'BROKEN' | 'THEFT' | 'OTHER';
export const WASTE_REASONS: WasteReason[] = ['EXPIRED', 'BROKEN', 'THEFT', 'OTHER'];

export interface RecordPurchaseInput {
  productId: string;
  quantity: DecimalLike;
  unitCost: DecimalLike;
  /**
   * Unidad en la que se expresa `quantity` y `unitCost`.
   * Si difiere de la unidad base del producto, el servicio convierte ambos
   * antes de persistir (cantidad al unit base, costo escalado inversamente
   * para preservar el total de la compra).
   * Si null/undefined, se asume que ya viene en la unidad del producto.
   */
  unitOfMeasure?: UnitOfMeasure | null;
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
 * Snapshot mínimo de un MenuItem para el cálculo batch de stock.
 * Mutuamente exclusivo: si `ingredients` tiene filas, se descuenta cada una;
 * si no pero hay `productId`, se descuenta el producto directo 1:1.
 */
export interface StockBatchMenuItem {
  productId: string | null;
  ingredients: {
    productId: string;
    quantity: Prisma.Decimal | number | string;
    unit: UnitOfMeasure | null;
  }[];
}

/**
 * Item de venta batch. Replica la lógica de `recordSaleForOrderItem` pero recibe
 * los datos pre-cargados (sin queries internas).
 */
export interface StockBatchSaleItem {
  orderItemId: string;
  /** Multiplicador del OrderItem (cantidad vendida). */
  quantity: number;
  /** Si el OrderItem está ligado a un MenuItem, su snapshot. */
  menuItem: StockBatchMenuItem | null;
  /** OrderItem sin menuItem pero con productId directo (caso histórico). */
  productId: string | null;
  extras: { quantity: number; menuItem: StockBatchMenuItem }[];
}

type StockBatchProduct = Pick<Product, 'id' | 'unitOfMeasure' | 'trackStock' | 'stockActual' | 'branchId'>;

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
  // Cliente extendido: la tenant extension filtra e inyecta branchId, también dentro
  // de las transacciones que abre este servicio.
  private get prisma() {
    return getPrisma();
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
    tx?: TenantTransactionClient
  ): Promise<StockMovement | null> {
    const inputQuantity = new Decimal(input.quantity);
    const inputUnitCost = new Decimal(input.unitCost);

    if (inputQuantity.lessThanOrEqualTo(0)) {
      throw new AppError('STOCK_INVALID_QUANTITY', 'quantity must be positive for purchases');
    }
    if (inputUnitCost.lessThan(0)) {
      throw new AppError('VALIDATION_ERROR', 'unitCost cannot be negative');
    }

    const run = async (client: TenantTransactionClient): Promise<StockMovement | null> => {
      const product = await client.product.findUnique({ where: { id: input.productId } });
      if (!product) {
        throw new AppError('PRODUCT_NOT_FOUND', `Product ${input.productId} not found`);
      }

      // ── Conversión a la unidad base del producto ──────────────────────────
      // Si la compra trae `unitOfMeasure` distinto al del producto, convertimos
      // tanto cantidad como costo unitario para preservar el total ($total fijo).
      // Ej: comprar 100 G a $0.50/G → almacenar 0.1 KG a $500/KG (total = $50).
      const purchaseUnit = input.unitOfMeasure ?? product.unitOfMeasure;
      if (
        purchaseUnit &&
        product.unitOfMeasure &&
        purchaseUnit !== product.unitOfMeasure &&
        !unitsCompatible(purchaseUnit, product.unitOfMeasure)
      ) {
        throw new AppError(
          'INCOMPATIBLE_UNIT',
          `La unidad de la compra (${purchaseUnit}) no es compatible con la unidad del producto "${product.name}" (${product.unitOfMeasure}). Cambiá la unidad del item o ajustá la unidad del producto antes de registrar la compra.`
        );
      }

      const quantity = convertQuantity(inputQuantity, purchaseUnit, product.unitOfMeasure);
      // Total = inputQuantity * inputUnitCost (no cambia con la conversión).
      // unitCost en unidad del producto = total / quantity.
      const total = inputQuantity.times(inputUnitCost);
      const unitCost = quantity.equals(0) ? inputUnitCost : total.dividedBy(quantity);

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
          branchId: product.branchId,
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
    tx?: TenantTransactionClient
  ): Promise<StockMovement[]> {
    const run = async (client: TenantTransactionClient): Promise<StockMovement[]> => {
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
   * Versión batch de `recordSaleForOrderItem` para crear órdenes con N items en
   * una sola transacción rápida. Recibe los datos ya pre-cargados (productMap +
   * snapshot de menuItems) — no hace queries de lectura adentro. Usa `createMany`
   * para los movements y un único `update` por producto (deltas acumulados).
   *
   * Pensado para el flujo de creación de orden, donde la unidad atómica es la
   * orden completa. Para flujos de a un item (update/cancel/edit), seguir usando
   * `recordSaleForOrderItem`.
   *
   * Reglas idénticas al singular:
   * - Productos con `trackStock=false` se ignoran silenciosamente.
   * - Stock negativo se permite (warning).
   * - Las unidades de receta se convierten a la unidad base del producto.
   */
  async recordSalesBatch(
    items: StockBatchSaleItem[],
    productMap: Map<string, StockBatchProduct>,
    userId: string | null,
    tx: TenantTransactionClient
  ): Promise<void> {
    if (items.length === 0) return;

    const movementRows: {
      productId: string;
      quantity: Prisma.Decimal;
      type: StockMovementType;
      orderItemId: string;
      userId: string | null;
      branchId: string | null;
    }[] = [];

    // Delta firmado acumulado por producto (negativo = salida).
    const deltaByProduct = new Map<string, Prisma.Decimal>();

    const pushMovement = (productId: string, qty: Prisma.Decimal, orderItemId: string): void => {
      const product = productMap.get(productId);
      if (!product || !product.trackStock) return;
      movementRows.push({
        productId,
        quantity: qty,
        type: StockMovementType.SALE,
        orderItemId,
        userId,
        branchId: product.branchId,
      });
      const prev = deltaByProduct.get(productId) ?? new Decimal(0);
      deltaByProduct.set(productId, prev.plus(qty));
    };

    const discountMenuItem = (
      menuItem: StockBatchMenuItem,
      multiplier: number,
      orderItemId: string
    ): void => {
      if (menuItem.ingredients.length > 0) {
        for (const ing of menuItem.ingredients) {
          const product = productMap.get(ing.productId);
          if (!product || !product.trackStock) continue;
          const ingUnit = ing.unit ?? product.unitOfMeasure;
          const qtyInProductUnit = convertQuantity(ing.quantity, ingUnit, product.unitOfMeasure);
          const movementQty = qtyInProductUnit.times(multiplier).negated();
          pushMovement(ing.productId, movementQty, orderItemId);
        }
        return;
      }
      if (menuItem.productId) {
        pushMovement(menuItem.productId, new Decimal(multiplier).negated(), orderItemId);
      }
    };

    for (const item of items) {
      if (item.menuItem) {
        discountMenuItem(item.menuItem, item.quantity, item.orderItemId);
      } else if (item.productId) {
        pushMovement(item.productId, new Decimal(item.quantity).negated(), item.orderItemId);
      }
      for (const extra of item.extras) {
        discountMenuItem(extra.menuItem, extra.quantity, item.orderItemId);
      }
    }

    if (movementRows.length === 0) return;

    await tx.stockMovement.createMany({ data: movementRows });

    for (const [productId, delta] of deltaByProduct) {
      if (delta.isZero()) continue;
      await tx.product.update({
        where: { id: productId },
        data: { stockActual: { increment: delta } },
      });
      const product = productMap.get(productId)!;
      this.warnIfNegative(product.stockActual.plus(delta), productId);
    }
  }

  /**
   * Descuenta el stock correspondiente a un MenuItem (con receta o producto directo).
   * Si tiene `ingredients`, descuenta cada uno; si no pero tiene `productId`, descuenta
   * 1 unidad del producto por cada `quantity`. Si nada aplica, devuelve [].
   */
  private async discountForMenuItem(
    client: TenantTransactionClient,
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
            branchId: product.branchId,
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
    client: TenantTransactionClient,
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
        branchId: product.branchId,
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
    tx?: TenantTransactionClient
  ): Promise<StockMovement[]> {
    const run = async (client: TenantTransactionClient): Promise<StockMovement[]> => {
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
            branchId: sale.branchId,
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

  /**
   * Versión batch de `reverseSaleForOrderItem` para flujos que afectan N items
   * (eliminar orden, editar items). Idéntica semántica idempotente: filtra los
   * orderItemIds que ya tienen un SALE_REVERSAL, revierte el resto en bulk con
   * `createMany` + un único `update` por producto (deltas acumulados).
   *
   * Requiere correr dentro de una transacción (no abre $transaction propio).
   */
  async reverseSalesBatch(
    orderItemIds: string[],
    userId: string | null,
    reason: string,
    tx: TenantTransactionClient
  ): Promise<void> {
    if (orderItemIds.length === 0) return;

    // Idempotencia: descartar los items que ya tienen reversal previo.
    const alreadyReversed = await tx.stockMovement.findMany({
      where: {
        orderItemId: { in: orderItemIds },
        type: StockMovementType.SALE_REVERSAL,
      },
      select: { orderItemId: true },
    });
    const reversedSet = new Set(alreadyReversed.map((r) => r.orderItemId).filter((id): id is string => id != null));
    const targetIds = orderItemIds.filter((id) => !reversedSet.has(id));
    if (targetIds.length === 0) return;

    // Cargar TODAS las ventas originales en una sola query.
    const sales = await tx.stockMovement.findMany({
      where: { orderItemId: { in: targetIds }, type: StockMovementType.SALE },
    });
    if (sales.length === 0) return;

    const reversalRows: {
      productId: string;
      quantity: Prisma.Decimal;
      type: StockMovementType;
      orderItemId: string;
      userId: string | null;
      reason: string;
      branchId: string | null;
    }[] = [];
    const deltaByProduct = new Map<string, Prisma.Decimal>();

    for (const sale of sales) {
      const reverseQty = sale.quantity.negated();
      reversalRows.push({
        productId: sale.productId,
        quantity: reverseQty,
        type: StockMovementType.SALE_REVERSAL,
        orderItemId: sale.orderItemId!,
        userId,
        reason,
        branchId: sale.branchId,
      });
      const prev = deltaByProduct.get(sale.productId) ?? new Decimal(0);
      deltaByProduct.set(sale.productId, prev.plus(reverseQty));
    }

    await tx.stockMovement.createMany({ data: reversalRows });

    for (const [productId, delta] of deltaByProduct) {
      if (delta.isZero()) continue;
      await tx.product.update({
        where: { id: productId },
        data: { stockActual: { increment: delta } },
      });
    }
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
    tx?: TenantTransactionClient
  ): Promise<StockMovement | null> {
    if (!input.reason || input.reason.trim().length === 0) {
      throw new AppError('STOCK_REASON_REQUIRED', 'reason is required for purchase reversal');
    }

    const run = async (client: TenantTransactionClient): Promise<StockMovement | null> => {
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
          branchId: original.branchId,
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
          branchId: product.branchId,
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
          branchId: product.branchId,
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

  async getMovements(
    filters: MovementsFilters = {}
  ): Promise<
    (StockMovement & {
      user: { name: string; last_name: string; second_last_name: string | null } | null;
    })[]
  > {
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
      include: {
        user: {
          select: { name: true, last_name: true, second_last_name: true },
        },
      },
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
