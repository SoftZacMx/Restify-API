import { inject, injectable } from 'tsyringe';
import { IOrderRepository } from '../../../domain/interfaces/order-repository.interface';
import { ITableRepository } from '../../../domain/interfaces/table-repository.interface';
import { DeleteOrderInput } from '../../dto/order.dto';
import { AppError } from '../../../../shared/errors';
import { QueueOrderNotificationUseCase } from '../websocket/queue-order-notification.use-case';
import { OrderNotificationType } from '../websocket/notify-order-status.use-case';

@injectable()
export class DeleteOrderUseCase {
  constructor(
    @inject('IOrderRepository') private readonly orderRepository: IOrderRepository,
    @inject('ITableRepository') private readonly tableRepository: ITableRepository,
    @inject(QueueOrderNotificationUseCase) private readonly queueOrderNotificationUseCase: QueueOrderNotificationUseCase
  ) {}

  async execute(input: DeleteOrderInput): Promise<void> {
    // Check if order exists
    const order = await this.orderRepository.findById(input.order_id);
    if (!order) {
      throw new AppError('ORDER_NOT_FOUND');
    }

    // Queue WebSocket notification for order cancellation (non-blocking, decoupled)
    // Send before deletion to have order data available
    // This ensures notifications are delivered even if staff members are temporarily disconnected
    this.queueOrderNotificationUseCase
      .execute({
        orderId: order.id,
        notificationType: OrderNotificationType.CANCELED,
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
        console.error('Failed to queue order cancellation notification:', error);
      });

    // Si la orden tiene mesa asignada y es Local, liberar la mesa antes de eliminar
    if (order.tableId && order.origin.toLowerCase() === 'local') {
      await this.tableRepository.update(order.tableId, { availabilityStatus: true });
    }

    // Delete order (cascade will delete order items and order item extras)
    await this.orderRepository.delete(input.order_id);
  }
}

