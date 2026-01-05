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
    productId: string;
    createdAt: Date;
    updatedAt: Date;
  }>;
  orderMenuItems?: Array<{
    id: string;
    menuItemId: string;
    amount: number;
    unitPrice: number;
    note: string | null;
    createdAt: Date;
    updatedAt: Date;
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

    // Verify that table exists if provided
    if (input.tableId) {
      const table = await this.tableRepository.findById(input.tableId);
      if (!table) {
        throw new AppError('TABLE_NOT_FOUND');
      }
    }

    // Verify all products exist and calculate subtotal from orderItems
    let orderItemsSubtotal = 0;
    if (input.orderItems && input.orderItems.length > 0) {
      for (const item of input.orderItems) {
        const product = await this.productRepository.findById(item.productId);
        if (!product) {
          throw new AppError('PRODUCT_NOT_FOUND', `Product with ID ${item.productId} not found`);
        }
        orderItemsSubtotal += item.price * item.quantity;
      }
    }

    // Verify all menu items exist and calculate subtotal from orderMenuItems
    let orderMenuItemsSubtotal = 0;
    if (input.orderMenuItems && input.orderMenuItems.length > 0) {
      for (const item of input.orderMenuItems) {
        const menuItem = await this.menuItemRepository.findById(item.menuItemId);
        if (!menuItem) {
          throw new AppError('MENU_ITEM_NOT_FOUND', `Menu item with ID ${item.menuItemId} not found`);
        }
        orderMenuItemsSubtotal += item.unitPrice * item.amount;
      }
    }

    // Calculate totals
    const subtotal = orderItemsSubtotal + orderMenuItemsSubtotal;
    const iva = subtotal * 0.16; // 16% IVA (puede ser configurable)
    const total = subtotal + iva + (input.tip || 0);

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

    // Create order items
    if (input.orderItems && input.orderItems.length > 0) {
      for (const item of input.orderItems) {
        await this.orderRepository.createOrderItem({
          quantity: item.quantity,
          price: item.price,
          orderId: order.id,
          productId: item.productId,
        });
      }
    }

    // Create order menu items
    if (input.orderMenuItems && input.orderMenuItems.length > 0) {
      for (const item of input.orderMenuItems) {
        await this.orderRepository.createOrderMenuItem({
          orderId: order.id,
          menuItemId: item.menuItemId,
          amount: item.amount,
          unitPrice: item.unitPrice,
          note: item.note || null,
        });
      }
    }

    // Get created order items
    const createdOrderItems = await this.orderRepository.findOrderItemsByOrderId(order.id);
    const finalOrderMenuItems = await this.orderRepository.findOrderMenuItemsByOrderId(order.id);

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
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      orderMenuItems: finalOrderMenuItems.map((item) => ({
        id: item.id,
        menuItemId: item.menuItemId,
        amount: item.amount,
        unitPrice: item.unitPrice,
        note: item.note,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
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

