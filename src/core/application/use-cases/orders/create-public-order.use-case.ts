import { inject, injectable } from 'tsyringe';
import { randomUUID } from 'crypto';
import { IMenuItemRepository } from '../../../domain/interfaces/menu-item-repository.interface';
import { IOrderRepository } from '../../../domain/interfaces/order-repository.interface';
import { AppError } from '../../../../shared/errors';

export interface CreatePublicOrderInput {
  customerName: string;
  customerPhone: string;
  orderType: 'DELIVERY' | 'PICKUP';
  deliveryAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  scheduledAt?: string | null;
  items: {
    menuItemId: string;
    quantity: number;
    note?: string | null;
    extras?: { extraId: string; quantity: number }[];
  }[];
}

export interface CreatePublicOrderResult {
  id: string;
  trackingToken: string;
  total: number;
  subtotal: number;
  origin: string;
  customerName: string;
  orderType: 'DELIVERY' | 'PICKUP';
  createdAt: Date;
}

@injectable()
export class CreatePublicOrderUseCase {
  constructor(
    @inject('IMenuItemRepository') private readonly menuItemRepository: IMenuItemRepository,
    @inject('IOrderRepository') private readonly orderRepository: IOrderRepository
  ) {}

  async execute(input: CreatePublicOrderInput): Promise<CreatePublicOrderResult> {
    // 1. Validar que hay items
    if (!input.items || input.items.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'At least one item is required');
    }

    // 2. Validar items y extras existen y están activos, calcular subtotal
    let subtotal = 0;

    for (const item of input.items) {
      const menuItem = await this.menuItemRepository.findById(item.menuItemId);
      if (!menuItem) {
        throw new AppError('MENU_ITEM_NOT_FOUND', `Menu item with ID ${item.menuItemId} not found`);
      }
      if (!menuItem.status) {
        throw new AppError('MENU_ITEM_NOT_AVAILABLE', `Menu item "${menuItem.name}" is not available`);
      }
      if (menuItem.isExtra) {
        throw new AppError('INVALID_MENU_ITEM', `Menu item "${menuItem.name}" is an extra and should be in the extras array`);
      }

      subtotal += menuItem.price * item.quantity;

      if (item.extras && item.extras.length > 0) {
        for (const extra of item.extras) {
          const extraMenuItem = await this.menuItemRepository.findById(extra.extraId);
          if (!extraMenuItem) {
            throw new AppError('MENU_ITEM_NOT_FOUND', `Extra with ID ${extra.extraId} not found`);
          }
          if (!extraMenuItem.status) {
            throw new AppError('MENU_ITEM_NOT_AVAILABLE', `Extra "${extraMenuItem.name}" is not available`);
          }
          if (!extraMenuItem.isExtra) {
            throw new AppError('INVALID_EXTRA', `Menu item "${extraMenuItem.name}" is not an extra`);
          }

          subtotal += extraMenuItem.price * extra.quantity;
        }
      }
    }

    const total = subtotal;
    const trackingToken = randomUUID();
    const origin = input.orderType === 'DELIVERY' ? 'online-delivery' : 'online-pickup';

    // 3. Crear la orden
    const order = await this.orderRepository.create({
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
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      trackingToken,
    });

    // 4. Crear order items y extras
    for (const item of input.items) {
      const menuItem = await this.menuItemRepository.findById(item.menuItemId);
      const createdItem = await this.orderRepository.createOrderItem({
        quantity: item.quantity,
        price: menuItem!.price,
        orderId: order.id,
        productId: null,
        menuItemId: item.menuItemId,
        note: item.note ?? null,
      });

      if (item.extras && item.extras.length > 0) {
        for (const extra of item.extras) {
          const extraMenuItem = await this.menuItemRepository.findById(extra.extraId);
          await this.orderRepository.createOrderItemExtra({
            orderId: order.id,
            orderItemId: createdItem.id,
            extraId: extra.extraId,
            quantity: extra.quantity,
            price: extraMenuItem!.price,
          });
        }
      }
    }

    return {
      id: order.id,
      trackingToken,
      total,
      subtotal,
      origin,
      customerName: input.customerName,
      orderType: input.orderType,
      createdAt: order.createdAt,
    };
  }
}
