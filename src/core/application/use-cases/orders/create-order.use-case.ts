import { inject, injectable } from 'tsyringe';
import { IOrderRepository } from '../../../domain/interfaces/order-repository.interface';
import { IUserRepository } from '../../../domain/interfaces/user-repository.interface';
import { ITableRepository } from '../../../domain/interfaces/table-repository.interface';
import { IProductRepository } from '../../../domain/interfaces/product-repository.interface';
import { IMenuItemRepository } from '../../../domain/interfaces/menu-item-repository.interface';
import { CreateOrderInput } from '../../dto/order.dto';
import { AppError } from '../../../../shared/errors';
import { QueueOrderNotificationUseCase } from '../websocket/queue-order-notification.use-case';
import { OrderNotificationType } from '../websocket/notify-order-status.use-case';

export interface CreateOrderResult {
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
  userId: string;
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
export class CreateOrderUseCase {
  constructor(
    @inject('IOrderRepository') private readonly orderRepository: IOrderRepository,
    @inject('IUserRepository') private readonly userRepository: IUserRepository,
    @inject('ITableRepository') private readonly tableRepository: ITableRepository,
    @inject('IProductRepository') private readonly productRepository: IProductRepository,
    @inject('IMenuItemRepository') private readonly menuItemRepository: IMenuItemRepository,
    @inject(QueueOrderNotificationUseCase) private readonly queueOrderNotificationUseCase: QueueOrderNotificationUseCase
  ) {}

  async execute(input: CreateOrderInput): Promise<CreateOrderResult> {
    // Verify that user exists
    const user = await this.userRepository.findById(input.userId);
    if (!user) {
      throw new AppError('USER_NOT_FOUND');
    }

    // Verify that table exists and is available if provided
    if (input.tableId) {
      const table = await this.tableRepository.findById(input.tableId);
      if (!table) {
        throw new AppError('TABLE_NOT_FOUND');
      }
      
      // If order is local and has a table assigned, verify table is available
      if (input.origin.toLowerCase() === 'local' && !table.availabilityStatus) {
        throw new AppError('TABLE_NOT_AVAILABLE');
      }
    }

    // Verify all items exist and calculate subtotal from orderItems (including extras)
    let subtotal = 0;
    if (input.orderItems && input.orderItems.length > 0) {
      for (const item of input.orderItems) {
        if (item.productId) {
          const product = await this.productRepository.findById(item.productId);
          if (!product) {
            throw new AppError('PRODUCT_NOT_FOUND', `Product with ID ${item.productId} not found`);
          }
        } else if (item.menuItemId) {
          const menuItem = await this.menuItemRepository.findById(item.menuItemId);
          if (!menuItem) {
            throw new AppError('MENU_ITEM_NOT_FOUND', `Menu item with ID ${item.menuItemId} not found`);
          }
          // Verify that menu item is not an extra (extras should be in extras array)
          if (menuItem.isExtra) {
            throw new AppError('INVALID_MENU_ITEM', `Menu item with ID ${item.menuItemId} is an extra and should be in the extras array`);
          }
        }
        
        // Calculate item subtotal
        subtotal += item.price * item.quantity;
        
        // Verify and calculate extras subtotal
        if (item.extras && item.extras.length > 0) {
          for (const extra of item.extras) {
            const extraMenuItem = await this.menuItemRepository.findById(extra.extraId);
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
    }

    // Totals: no IVA aplicado automáticamente
    const iva = 0;
    const total = subtotal + (input.tip || 0);

    // Create order
    const order = await this.orderRepository.create({
      status: false, // Orders start as unpaid
      paymentMethod: input.paymentMethod ?? 1,
      total,
      subtotal,
      iva,
      delivered: false,
      tableId: input.tableId || null,
      tip: input.tip || 0,
      origin: input.origin,
      client: input.client || null,
      paymentDiffer: input.paymentDiffer ?? false,
      note: input.note || null,
      userId: input.userId,
    });

    // Mark table as unavailable if order is local and has a table assigned
    if (order.tableId && order.origin.toLowerCase() === 'local') {
      await this.tableRepository.update(order.tableId, {
        availabilityStatus: false, // Mark table as unavailable
      });
    }

    // Create order items and their extras
    if (input.orderItems && input.orderItems.length > 0) {
      for (const item of input.orderItems) {
        const createdOrderItem = await this.orderRepository.createOrderItem({
          quantity: item.quantity,
          price: item.price,
          orderId: order.id,
          productId: item.productId || null,
          menuItemId: item.menuItemId || null,
          note: item.note || null,
        });

        // Create extras for this order item
        if (item.extras && item.extras.length > 0) {
          for (const extra of item.extras) {
            await this.orderRepository.createOrderItemExtra({
              orderId: order.id,
              orderItemId: createdOrderItem.id,
              extraId: extra.extraId,
              quantity: extra.quantity,
              price: extra.price,
            });
          }
        }
      }
    }

    // Get created order items
    const createdOrderItems = await this.orderRepository.findOrderItemsByOrderId(order.id);
    // Get all extras for this order (optimized query)
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
      orderItems: createdOrderItems.map((item) => ({
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

    // Queue WebSocket notification for order creation (non-blocking, decoupled)
    // This ensures notifications are delivered even if staff members are temporarily disconnected
    this.queueOrderNotificationUseCase
      .execute({
        orderId: order.id,
        notificationType: OrderNotificationType.CREATED,
        orderData: {
          id: order.id,
          date: order.date,
          status: order.status,
          total: order.total,
          subtotal: order.subtotal,
          delivered: order.delivered,
          tableId: order.tableId,
          origin: order.origin,
          client: order.client,
        },
      })
      .catch((error) => {
        // Log error but don't fail the use case if queueing fails
        console.error('Failed to queue order creation notification:', error);
      });

    return orderResult;
  }
}

