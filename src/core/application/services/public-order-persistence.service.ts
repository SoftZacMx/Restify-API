import { inject, injectable } from 'tsyringe';
import { randomUUID } from 'crypto';
import { getPrisma } from '../../infrastructure/database/prisma/get-prisma';
import { PrismaService } from '../../infrastructure/config/prisma.config';
import { StockService, StockBatchSaleItem } from './stock.service';
import { AppError } from '../../../shared/errors';

/** Item de pedido público (menuItem + extras). Compartido por creación directa y checkout. */
export interface PublicOrderItemInput {
  menuItemId: string;
  quantity: number;
  note?: string | null;
  extras?: { extraId: string; quantity: number }[];
}

export interface ValidatedPublicOrder {
  subtotal: number;
  total: number;
}

export interface PersistPublicOrderInput {
  branchId: string;
  customerName: string;
  customerPhone: string;
  orderType: 'DELIVERY' | 'PICKUP';
  deliveryAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  scheduledAt?: Date | null;
  items: PublicOrderItemInput[];
  /** Token de seguimiento. Si se omite se genera uno nuevo. */
  trackingToken?: string;
}

export interface PersistedPublicOrder {
  id: string;
  trackingToken: string;
  total: number;
  subtotal: number;
  origin: string;
  createdAt: Date;
}

/**
 * Lógica compartida para validar/precificar y persistir pedidos públicos.
 *
 * Extraída de CreatePublicOrderUseCase para poder reutilizarla desde el flujo de
 * checkout (Opción A): la validación/precio se usa ANTES de pagar (para armar la
 * preferencia de MP) y la persistencia se ejecuta DESPUÉS, al confirmar el pago.
 */
@injectable()
export class PublicOrderPersistenceService {
  constructor(
    @inject(PrismaService) private readonly prismaService: PrismaService,
    @inject(StockService) private readonly stockService: StockService,
  ) {}

  /**
   * Valida que los items existan/estén disponibles y calcula subtotal + total.
   * No escribe nada. Corre dentro del tenant context del branch.
   */
  async validateAndPrice(items: PublicOrderItemInput[]): Promise<ValidatedPublicOrder> {
    if (!items || items.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'At least one item is required');
    }

    const prisma = getPrisma();
    const menuItemIds = new Set<string>();
    for (const item of items) {
      menuItemIds.add(item.menuItemId);
      for (const extra of item.extras ?? []) {
        menuItemIds.add(extra.extraId);
      }
    }

    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: [...menuItemIds] } },
    });
    const menuItemMap = new Map(menuItems.map((m) => [m.id, m]));

    let subtotal = 0;
    for (const item of items) {
      const menuItem = menuItemMap.get(item.menuItemId);
      if (!menuItem) {
        throw new AppError('MENU_ITEM_NOT_FOUND', `Menu item with ID ${item.menuItemId} not found`);
      }
      if (!menuItem.status) {
        throw new AppError('MENU_ITEM_NOT_AVAILABLE', `Menu item "${menuItem.name}" is not available`);
      }
      if (menuItem.isExtra) {
        throw new AppError('INVALID_MENU_ITEM', `Menu item "${menuItem.name}" is an extra and should be in the extras array`);
      }

      subtotal += Number(menuItem.price) * item.quantity;

      for (const extra of item.extras ?? []) {
        const extraMenuItem = menuItemMap.get(extra.extraId);
        if (!extraMenuItem) {
          throw new AppError('MENU_ITEM_NOT_FOUND', `Extra with ID ${extra.extraId} not found`);
        }
        if (!extraMenuItem.status) {
          throw new AppError('MENU_ITEM_NOT_AVAILABLE', `Extra "${extraMenuItem.name}" is not available`);
        }
        if (!extraMenuItem.isExtra) {
          throw new AppError('INVALID_EXTRA', `Menu item "${extraMenuItem.name}" is not an extra`);
        }
        subtotal += Number(extraMenuItem.price) * extra.quantity;
      }
    }

    return { subtotal, total: subtotal };
  }

  /**
   * Crea la orden real (items + extras) y descuenta stock, en una transacción.
   * Opción 1: si el stock queda insuficiente NO se bloquea la creación — el
   * StockService sólo advierte al quedar negativo, y el staff resuelve el faltante.
   * Corre dentro del tenant context del branch.
   */
  async persistOrder(input: PersistPublicOrderInput): Promise<PersistedPublicOrder> {
    const prisma = getPrisma();

    const menuItemIds = new Set<string>();
    for (const item of input.items) {
      menuItemIds.add(item.menuItemId);
      for (const extra of item.extras ?? []) {
        menuItemIds.add(extra.extraId);
      }
    }

    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: [...menuItemIds] } },
      include: { ingredients: true },
    });
    const menuItemMap = new Map(menuItems.map((m) => [m.id, m]));

    const stockProductIds = new Set<string>();
    for (const mi of menuItems) {
      if (mi.productId) stockProductIds.add(mi.productId);
      for (const ing of mi.ingredients) stockProductIds.add(ing.productId);
    }
    const products = stockProductIds.size > 0
      ? await prisma.product.findMany({ where: { id: { in: [...stockProductIds] } } })
      : [];
    const productMap = new Map(products.map((p) => [p.id, p]));

    // Recalcular subtotal desde precios actuales (fuente de verdad al materializar).
    let subtotal = 0;
    for (const item of input.items) {
      const menuItem = menuItemMap.get(item.menuItemId);
      if (!menuItem) {
        throw new AppError('MENU_ITEM_NOT_FOUND', `Menu item with ID ${item.menuItemId} not found`);
      }
      subtotal += Number(menuItem.price) * item.quantity;
      for (const extra of item.extras ?? []) {
        const extraMI = menuItemMap.get(extra.extraId);
        if (!extraMI) {
          throw new AppError('MENU_ITEM_NOT_FOUND', `Extra with ID ${extra.extraId} not found`);
        }
        subtotal += Number(extraMI.price) * extra.quantity;
      }
    }

    const total = subtotal;
    const trackingToken = input.trackingToken ?? randomUUID();
    const origin = input.orderType === 'DELIVERY' ? 'online-delivery' : 'online-pickup';

    const prepared = input.items.map((item) => ({
      id: randomUUID(),
      input: item,
      extras: (item.extras ?? []).map((extra) => ({ id: randomUUID(), input: extra })),
    }));

    const result = await this.prismaService.getClient().$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          status: false,
          paymentMethod: null,
          total,
          subtotal,
          iva: 0,
          delivered: false,
          tableId: null,
          tip: 0,
          origin,
          client: null,
          paymentDiffer: false,
          note: null,
          userId: null,
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          latitude: input.latitude ?? null,
          longitude: input.longitude ?? null,
          deliveryAddress: input.deliveryAddress ?? null,
          scheduledAt: input.scheduledAt ?? null,
          trackingToken,
          branchId: input.branchId,
        },
      });

      await tx.orderItem.createMany({
        data: prepared.map((p) => ({
          id: p.id,
          quantity: p.input.quantity,
          price: Number(menuItemMap.get(p.input.menuItemId)!.price),
          orderId: order.id,
          productId: null,
          menuItemId: p.input.menuItemId,
          note: p.input.note ?? null,
          branchId: input.branchId,
        })),
      });

      const extraRows = prepared.flatMap((p) =>
        p.extras.map((e) => ({
          id: e.id,
          orderId: order.id,
          orderItemId: p.id,
          extraId: e.input.extraId,
          quantity: e.input.quantity,
          price: Number(menuItemMap.get(e.input.extraId)!.price),
          branchId: input.branchId,
        }))
      );
      if (extraRows.length > 0) {
        await tx.orderItemExtra.createMany({ data: extraRows });
      }

      const saleBatch: StockBatchSaleItem[] = prepared.map((p) => {
        const menuItem = menuItemMap.get(p.input.menuItemId)!;
        return {
          orderItemId: p.id,
          quantity: p.input.quantity,
          menuItem: {
            productId: menuItem.productId,
            ingredients: menuItem.ingredients.map((i) => ({
              productId: i.productId,
              quantity: i.quantity,
              unit: i.unit,
            })),
          },
          productId: null,
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

      await this.stockService.recordSalesBatch(saleBatch, productMap, null, tx);

      return order;
    });

    return {
      id: result.id,
      trackingToken,
      total,
      subtotal,
      origin,
      createdAt: result.createdAt,
    };
  }
}
