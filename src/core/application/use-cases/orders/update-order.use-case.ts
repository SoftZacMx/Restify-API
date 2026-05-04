import { randomUUID } from 'crypto';
import { inject, injectable } from 'tsyringe';
import { IOrderRepository } from '../../../domain/interfaces/order-repository.interface';
import { ITableRepository } from '../../../domain/interfaces/table-repository.interface';
import { PrismaService } from '../../../infrastructure/config/prisma.config';
import { StockService, StockBatchSaleItem } from '../../services/stock.service';
import { UpdateOrderInput } from '../../dto/order.dto';
import { AppError } from '../../../../shared/errors';

export interface UpdateOrderResult {
  id: string;
  date: Date;
  status: boolean;
  paymentMethod: number | null;
  total: number;
  subtotal: number;
  iva: number;
  delivered: boolean;
  tableId: string | null;
  tip: number;
  origin: string;
  client: string | null;
  paymentDiffer: boolean;
  note: string | null;
  userId: string | null;
  createdAt: Date;
  updatedAt: Date;
  orderItems?: Array<{
    id: string;
    quantity: number;
    price: number;
    productId: string | null;
    menuItemId: string | null;
    note: string | null;
    createdAt: Date;
    updatedAt: Date;
    extras?: Array<{
      id: string;
      extraId: string;
      quantity: number;
      price: number;
      createdAt: Date;
      updatedAt: Date;
    }>;
  }>;
}

@injectable()
export class UpdateOrderUseCase {
  constructor(
    @inject('IOrderRepository') private readonly orderRepository: IOrderRepository,
    @inject('ITableRepository') private readonly tableRepository: ITableRepository,
    @inject(PrismaService) private readonly prismaService: PrismaService,
    @inject(StockService) private readonly stockService: StockService,
  ) {}

  /**
   * @param actorUserId Usuario que ejecuta la edición (para autoría de movements de stock).
   *                    Null si la edición es del sistema.
   */
  async execute(
    orderId: string,
    input: UpdateOrderInput,
    actorUserId: string | null = null
  ): Promise<UpdateOrderResult> {
    // Check if order exists
    const existingOrder = await this.orderRepository.findById(orderId);
    if (!existingOrder) {
      throw new AppError('ORDER_NOT_FOUND');
    }

    // If tableId is being updated, verify that table exists
    if (input.tableId !== undefined && input.tableId !== null) {
      const table = await this.tableRepository.findById(input.tableId);
      if (!table) {
        throw new AppError('TABLE_NOT_FOUND');
      }
    }

    // Prepare update data
    const updateData: any = {};

    if (input.status !== undefined) updateData.status = input.status;
    if (input.paymentMethod !== undefined) updateData.paymentMethod = input.paymentMethod;
    if (input.delivered !== undefined) updateData.delivered = input.delivered;
    if (input.tip !== undefined) updateData.tip = input.tip;
    if (input.origin !== undefined) updateData.origin = input.origin;
    if (input.client !== undefined) updateData.client = input.client;
    if (input.paymentDiffer !== undefined) updateData.paymentDiffer = input.paymentDiffer;
    if (input.note !== undefined) updateData.note = input.note;
    if (input.tableId !== undefined) updateData.tableId = input.tableId;

    // Handle order items update if provided
    if (input.orderItems && input.orderItems.length > 0) {
      // Cannot modify items of a paid order
      if (existingOrder.status) {
        throw new AppError('ORDER_ALREADY_PAID', 'Cannot modify items of a paid order');
      }

      // Bulk-load menuItems con ingredientes y productos asociados.
      const prisma = this.prismaService.getClient();

      const menuItemIdsToLoad = new Set<string>();
      const directProductIds = new Set<string>();
      for (const item of input.orderItems) {
        if (item.menuItemId) menuItemIdsToLoad.add(item.menuItemId);
        if (item.productId) directProductIds.add(item.productId);
        for (const extra of item.extras ?? []) {
          menuItemIdsToLoad.add(extra.extraId);
        }
      }

      const menuItems = menuItemIdsToLoad.size > 0
        ? await prisma.menuItem.findMany({
            where: { id: { in: [...menuItemIdsToLoad] } },
            include: { ingredients: true },
          })
        : [];
      const menuItemMap = new Map(menuItems.map((m) => [m.id, m]));

      const stockProductIds = new Set<string>(directProductIds);
      for (const mi of menuItems) {
        if (mi.productId) stockProductIds.add(mi.productId);
        for (const ing of mi.ingredients) stockProductIds.add(ing.productId);
      }
      const products = stockProductIds.size > 0
        ? await prisma.product.findMany({ where: { id: { in: [...stockProductIds] } } })
        : [];
      const productMap = new Map(products.map((p) => [p.id, p]));

      // Validate all items exist + calcular subtotal usando los maps.
      let subtotal = 0;
      for (const item of input.orderItems) {
        if (item.productId) {
          if (!productMap.has(item.productId)) {
            throw new AppError('PRODUCT_NOT_FOUND', `Product with ID ${item.productId} not found`);
          }
        } else if (item.menuItemId) {
          const menuItem = menuItemMap.get(item.menuItemId);
          if (!menuItem) {
            throw new AppError('MENU_ITEM_NOT_FOUND', `Menu item with ID ${item.menuItemId} not found`);
          }
          if (menuItem.isExtra) {
            throw new AppError('INVALID_MENU_ITEM', `Menu item with ID ${item.menuItemId} is an extra`);
          }
        }

        subtotal += item.price * item.quantity;

        if (item.extras && item.extras.length > 0) {
          for (const extra of item.extras) {
            const extraMenuItem = menuItemMap.get(extra.extraId);
            if (!extraMenuItem) {
              throw new AppError('MENU_ITEM_NOT_FOUND', `Extra with ID ${extra.extraId} not found`);
            }
            if (!extraMenuItem.isExtra) {
              throw new AppError('INVALID_EXTRA', `Menu item with ID ${extra.extraId} is not an extra`);
            }
            subtotal += extra.price * extra.quantity;
          }
        }
      }

      // Pre-generar IDs para createMany.
      const prepared = input.orderItems.map((item) => ({
        id: randomUUID(),
        input: item,
        extras: (item.extras ?? []).map((extra) => ({
          id: randomUUID(),
          input: extra,
        })),
      }));

      // Reemplazo de items + reajuste de stock — todo atómico (Fase 4.3).
      // Estrategia "reversal + resale": mantiene el ledger limpio sin movements diferenciales.
      await prisma.$transaction(async (tx) => {
        // 1. Snapshot de items actuales para reversar sus ventas.
        const existingItems = await tx.orderItem.findMany({
          where: { orderId },
          select: { id: true },
        });

        await this.stockService.reverseSalesBatch(
          existingItems.map((i) => i.id),
          actorUserId,
          'order edited',
          tx
        );

        // 2. Borrar items + extras viejos (cascade DB también hace extras, pero somos explícitos).
        await tx.orderItemExtra.deleteMany({ where: { orderId } });
        await tx.orderItem.deleteMany({ where: { orderId } });

        // 3. Crear los items + extras nuevos en lote.
        await tx.orderItem.createMany({
          data: prepared.map((p) => ({
            id: p.id,
            quantity: p.input.quantity,
            price: p.input.price,
            orderId,
            productId: p.input.productId || null,
            menuItemId: p.input.menuItemId || null,
            note: p.input.note || null,
          })),
        });

        const extraRows = prepared.flatMap((p) =>
          p.extras.map((e) => ({
            id: e.id,
            orderId,
            orderItemId: p.id,
            extraId: e.input.extraId,
            quantity: e.input.quantity,
            price: e.input.price,
          }))
        );
        if (extraRows.length > 0) {
          await tx.orderItemExtra.createMany({ data: extraRows });
        }

        // 4. Stock batch para las ventas nuevas.
        const saleBatch: StockBatchSaleItem[] = prepared.map((p) => {
          const menuItem = p.input.menuItemId ? menuItemMap.get(p.input.menuItemId) ?? null : null;
          return {
            orderItemId: p.id,
            quantity: p.input.quantity,
            menuItem: menuItem
              ? {
                  productId: menuItem.productId,
                  ingredients: menuItem.ingredients.map((i) => ({
                    productId: i.productId,
                    quantity: i.quantity,
                    unit: i.unit,
                  })),
                }
              : null,
            productId: p.input.productId ?? null,
            extras: p.extras.map((e) => {
              const extraMI = menuItemMap.get(e.input.extraId)!;
              return {
                quantity: e.input.quantity,
                menuItem: {
                  productId: extraMI.productId,
                  ingredients: extraMI.ingredients.map((i) => ({
                    productId: i.productId,
                    quantity: i.quantity,
                    unit: i.unit,
                  })),
                },
              };
            }),
          };
        });

        await this.stockService.recordSalesBatch(saleBatch, productMap, actorUserId, tx);
      });

      // Calculate new totals (no IVA aplicado automáticamente)
      const tip = input.tip !== undefined ? input.tip : existingOrder.tip;
      const iva = 0;
      const total = subtotal + tip;

      updateData.subtotal = subtotal;
      updateData.iva = iva;
      updateData.total = total;
    }

    // Update order
    const order = await this.orderRepository.update(orderId, updateData);

    // Si la orden queda como entregada y es Local con mesa, liberar la mesa (p. ej. pago diferido: cierran sin llamar a POST .../pay)
    if (order.tableId && order.origin.toLowerCase() === 'local' && order.delivered) {
      await this.tableRepository.update(order.tableId, { availabilityStatus: true });
    }

    // Get order items
    const orderItems = await this.orderRepository.findOrderItemsByOrderId(order.id);

    // Get all extras for this order (optimized query with orderId)
    const allExtras = await this.orderRepository.findOrderItemExtrasByOrderId(order.id);

    // Group extras by orderItemId
    const extrasByItemId = allExtras.reduce((acc, extra) => {
      if (!acc[extra.orderItemId]) {
        acc[extra.orderItemId] = [];
      }
      acc[extra.orderItemId].push(extra);
      return acc;
    }, {} as Record<string, typeof allExtras>);

    const orderResult = {
      id: order.id,
      date: order.date,
      status: order.status,
      paymentMethod: order.paymentMethod,
      total: order.total,
      subtotal: order.subtotal,
      iva: order.iva,
      delivered: order.delivered,
      tableId: order.tableId,
      tip: order.tip,
      origin: order.origin,
      client: order.client,
      paymentDiffer: order.paymentDiffer,
      note: order.note,
      userId: order.userId,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      orderItems: orderItems.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        price: item.price,
        productId: item.productId,
        menuItemId: item.menuItemId,
        note: item.note,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        extras: (extrasByItemId[item.id] || []).map((extra) => ({
          id: extra.id,
          extraId: extra.extraId,
          quantity: extra.quantity,
          price: extra.price,
          createdAt: extra.createdAt,
          updatedAt: extra.updatedAt,
        })),
      })),
    };

    return orderResult;
  }
}
