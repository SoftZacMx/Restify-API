import { inject, injectable } from 'tsyringe';
import { IOrderRepository } from '../../../domain/interfaces/order-repository.interface';
import { ITableRepository } from '../../../domain/interfaces/table-repository.interface';
import { UpdateOrderInput } from '../../dto/order.dto';
import { AppError } from '../../../../shared/errors';
import { QueueOrderNotificationUseCase } from '../websocket/queue-order-notification.use-case';
import { OrderNotificationType } from '../websocket/notify-order-status.use-case';

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
export class UpdateOrderUseCase {
  constructor(
    @inject('IOrderRepository') private readonly orderRepository: IOrderRepository,
    @inject('ITableRepository') private readonly tableRepository: ITableRepository,
    @inject(QueueOrderNotificationUseCase) private readonly queueOrderNotificationUseCase: QueueOrderNotificationUseCase
  ) {}

  async execute(orderId: string, input: UpdateOrderInput): Promise<UpdateOrderResult> {
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

    // Update order
    const order = await this.orderRepository.update(orderId, updateData);

    // Get order items and menu items
    const orderItems = await this.orderRepository.findOrderItemsByOrderId(order.id);
    const orderMenuItems = await this.orderRepository.findOrderMenuItemsByOrderId(order.id);

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
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      orderMenuItems: orderMenuItems.map((item) => ({
        id: item.id,
        menuItemId: item.menuItemId,
        amount: item.amount,
        unitPrice: item.unitPrice,
        note: item.note,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
    };

    // Determine notification type based on what changed
    // If delivered status changed to true, send ORDER_DELIVERED notification
    // Otherwise, send ORDER_UPDATED notification
    const wasDelivered = existingOrder.delivered;
    const isNowDelivered = order.delivered;
    const deliveryStatusChanged = input.delivered !== undefined && wasDelivered !== isNowDelivered;

    const notificationType = deliveryStatusChanged && isNowDelivered
      ? OrderNotificationType.DELIVERED
      : OrderNotificationType.UPDATED;

    // Queue WebSocket notification for order update (non-blocking, decoupled)
    // This ensures notifications are delivered even if staff members are temporarily disconnected
    this.queueOrderNotificationUseCase
      .execute({
        orderId: order.id,
        notificationType,
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
        console.error('Failed to queue order update notification:', error);
      });

    return orderResult;
  }
}

