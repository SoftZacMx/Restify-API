import { inject, injectable } from 'tsyringe';
import { IOrderRepository } from '../../../domain/interfaces/order-repository.interface';
import { IMenuItemRepository } from '../../../domain/interfaces/menu-item-repository.interface';
import { IBranchRepository } from '../../../domain/interfaces/branch-repository.interface';
import { IPendingCheckoutRepository, PendingCheckout } from '../../../domain/interfaces/pending-checkout-repository.interface';
import { AppError } from '../../../../shared/errors';
import { withoutTenant } from '../../../infrastructure/tenant/tenant-context';
import { PendingCheckoutStatus } from '@prisma/client';

export interface PublicOrderStatus {
  // PAYMENT_FAILED: el pago no se completó (rechazado/cancelado); el cliente debe reintentar.
  status: 'PENDING_PAYMENT' | 'PAYMENT_FAILED' | 'PAID' | 'PREPARING' | 'READY' | 'ON_THE_WAY' | 'DELIVERED';
  trackingToken: string;
  customerName: string;
  orderType: 'DELIVERY' | 'PICKUP';
  scheduledAt: string | null;
  items: { name: string; quantity: number; total: number }[];
  total: number;
  createdAt: string;
  // Slug del branch para que la vista pública pueda redirigir de vuelta al menú (p. ej.
  // al reintentar tras un pago fallido). Null si el branch no tiene slug configurado.
  branchSlug: string | null;
}

@injectable()
export class GetPublicOrderStatusUseCase {
  constructor(
    @inject('IOrderRepository') private readonly orderRepository: IOrderRepository,
    @inject('IMenuItemRepository') private readonly menuItemRepository: IMenuItemRepository,
    @inject('IBranchRepository') private readonly branchRepository: IBranchRepository,
    @inject('IPendingCheckoutRepository') private readonly pendingCheckoutRepository: IPendingCheckoutRepository
  ) { }

  /** Resuelve el slug del branch (ruta pública: sin tenant context). */
  private async resolveBranchSlug(branchId: string | null): Promise<string | null> {
    if (!branchId) return null;
    const branch = await withoutTenant(() => this.branchRepository.findById(branchId));
    return branch?.slug ?? null;
  }

  async execute(trackingToken: string): Promise<PublicOrderStatus> {
    const order = await this.orderRepository.findByTrackingToken(trackingToken);

    // Con el checkout diferido (Opción A) la orden puede no existir todavía: el pago
    // se confirma por webhook asíncrono. Mientras tanto el borrador comparte el mismo
    // trackingToken y se reporta como "esperando pago" para que el tracking no falle.
    if (!order) {
      const checkout = await withoutTenant(() =>
        this.pendingCheckoutRepository.findByTrackingToken(trackingToken)
      );
      if (checkout) {
        return this.buildStatusFromCheckout(checkout);
      }
      throw new AppError('ORDER_NOT_FOUND');
    }

    if (order.deliveryStatus === 'DELIVERED') {
      throw new AppError('ORDER_ALREADY_DELIVERED');
    }

    return this.buildStatus(order);
  }

  /**
   * Resuelve el status a partir del orderId (no del trackingToken). Se usa en el
   * retorno de Mercado Pago: la back_url trae el `external_reference` (orderId), pero
   * el cliente puede haber perdido el trackingToken (webview de MP con storage aparte).
   * Solo aplica a órdenes públicas (userId === null); las del POS interno se rechazan
   * para no filtrar datos. Corre sin tenant context (ruta pública, sin JWT).
   */
  async executeByOrderId(orderId: string): Promise<PublicOrderStatus> {
    const order = await withoutTenant(() => this.orderRepository.findById(orderId));
    if (!order) {
      throw new AppError('ORDER_NOT_FOUND');
    }
    if (order.userId) {
      throw new AppError('ORDER_NOT_FOUND');
    }
    if (!order.trackingToken) {
      throw new AppError('ORDER_NOT_FOUND');
    }

    return this.buildStatus(order);
  }

  private async buildStatus(order: {
    id: string;
    branchId: string | null;
    deliveryStatus: string | null;
    status: boolean;
    delivered: boolean;
    origin: string;
    trackingToken: string | null;
    customerName: string | null;
    scheduledAt: Date | null;
    total: number;
    createdAt: Date;
  }): Promise<PublicOrderStatus> {
    // Determinar estado público: usar deliveryStatus si existe, sino inferir
    let status: PublicOrderStatus['status'];
    if (order.deliveryStatus) {
      status = order.deliveryStatus as PublicOrderStatus['status'];
    } else if (!order.status) {
      status = 'PENDING_PAYMENT';
    } else if (order.status && !order.delivered) {
      status = 'PAID';
    } else {
      status = 'DELIVERED';
    }

    // Obtener items con nombres
    const orderItems = await this.orderRepository.findOrderItemsByOrderId(order.id);
    const menuItemIds = orderItems
      .filter((item) => item.menuItemId)
      .map((item) => item.menuItemId!);

    const menuItems = menuItemIds.length > 0
      ? await this.menuItemRepository.findByIds(menuItemIds)
      : [];

    const menuItemMap = new Map(menuItems.map((mi) => [mi.id, mi.name]));

    const items = orderItems.map((item) => ({
      name: (item.menuItemId ? menuItemMap.get(item.menuItemId) : null) || 'Item',
      quantity: item.quantity,
      total: item.price * item.quantity,
    }));

    const orderType: PublicOrderStatus['orderType'] =
      order.origin === 'online-delivery' ? 'DELIVERY' : 'PICKUP';

    return {
      trackingToken: order.trackingToken!,
      status,
      customerName: order.customerName || '',
      orderType,
      scheduledAt: order.scheduledAt ? order.scheduledAt.toISOString() : null,
      items,
      total: order.total,
      createdAt: order.createdAt.toISOString(),
      branchSlug: await this.resolveBranchSlug(order.branchId),
    };
  }

  /**
   * Estado a partir de un borrador (la orden aún no se materializó). Reporta
   * PENDING_PAYMENT mientras espera el pago, o PAYMENT_FAILED si el borrador quedó
   * EXPIRED (pago cancelado/vencido) para que el cliente sepa que debe reintentar.
   * Los items se reconstruyen del snapshot del carrito.
   */
  private async buildStatusFromCheckout(checkout: PendingCheckout): Promise<PublicOrderStatus> {
    const menuItemIds = new Set<string>();
    for (const item of checkout.cart) {
      menuItemIds.add(item.menuItemId);
      for (const extra of item.extras ?? []) {
        menuItemIds.add(extra.extraId);
      }
    }

    const menuItems = menuItemIds.size > 0
      ? await withoutTenant(() => this.menuItemRepository.findByIds([...menuItemIds]))
      : [];
    const nameMap = new Map(menuItems.map((mi) => [mi.id, mi.name]));
    const priceMap = new Map(menuItems.map((mi) => [mi.id, mi.price]));

    const items = checkout.cart.map((item) => {
      const base = (priceMap.get(item.menuItemId) ?? 0) * item.quantity;
      const extrasTotal = (item.extras ?? []).reduce(
        (sum, e) => sum + (priceMap.get(e.extraId) ?? 0) * e.quantity,
        0
      );
      return {
        name: nameMap.get(item.menuItemId) || 'Item',
        quantity: item.quantity,
        total: base + extrasTotal,
      };
    });

    return {
      trackingToken: checkout.trackingToken,
      status: checkout.status === PendingCheckoutStatus.EXPIRED ? 'PAYMENT_FAILED' : 'PENDING_PAYMENT',
      customerName: checkout.customerName,
      orderType: checkout.orderType,
      scheduledAt: checkout.scheduledAt ? checkout.scheduledAt.toISOString() : null,
      items,
      total: checkout.total,
      createdAt: checkout.createdAt.toISOString(),
      branchSlug: await this.resolveBranchSlug(checkout.branchId),
    };
  }
}
