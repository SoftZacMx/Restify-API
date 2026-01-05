import { inject, injectable } from 'tsyringe';
import { IWebSocketConnectionManager } from '../../../domain/interfaces/websocket-connection.interface';
import { WebSocketEventType, WebSocketMessage } from '../../../domain/interfaces/websocket-connection.interface';

export enum OrderNotificationType {
  CREATED = 'created',
  UPDATED = 'updated',
  DELIVERED = 'delivered',
  CANCELED = 'canceled',
}

export interface NotifyOrderStatusInput {
  orderId: string;
  userId?: string; // Optional - not used for staff notifications
  notificationType: OrderNotificationType;
  orderData?: {
    id: string;
    date?: Date;
    status?: boolean;
    total?: number;
    subtotal?: number;
    delivered?: boolean;
    tableId?: string | null;
    origin?: string;
    client?: string | null;
  };
}

@injectable()
export class NotifyOrderStatusUseCase {
  constructor(
    @inject('IWebSocketConnectionManager')
    private readonly connectionManager: IWebSocketConnectionManager
  ) {}

  async execute(input: NotifyOrderStatusInput): Promise<{ notified: boolean; notifiedCount: number }> {
    // 1. Determine event type based on notification type
    let eventType: WebSocketEventType;
    let messageData: any;

    switch (input.notificationType) {
      case OrderNotificationType.CREATED:
        eventType = WebSocketEventType.ORDER_CREATED;
        messageData = {
          orderId: input.orderId,
          status: 'created',
          message: 'Order created successfully',
          order: input.orderData,
        };
        break;

      case OrderNotificationType.UPDATED:
        eventType = WebSocketEventType.ORDER_UPDATED;
        messageData = {
          orderId: input.orderId,
          status: 'updated',
          message: 'Order updated successfully',
          order: input.orderData,
        };
        break;

      case OrderNotificationType.DELIVERED:
        eventType = WebSocketEventType.ORDER_DELIVERED;
        messageData = {
          orderId: input.orderId,
          status: 'delivered',
          message: 'Order delivered successfully',
          order: input.orderData,
        };
        break;

      case OrderNotificationType.CANCELED:
        eventType = WebSocketEventType.ORDER_CANCELED;
        messageData = {
          orderId: input.orderId,
          status: 'canceled',
          message: 'Order canceled successfully',
          order: input.orderData,
        };
        break;

      default:
        return { notified: false, notifiedCount: 0 };
    }

    // 2. Create WebSocket message
    const message: WebSocketMessage = {
      type: eventType,
      data: messageData,
      timestamp: new Date(),
    };

    // 3. Send notification to all staff connections (ADMIN, MANAGER, WAITER, CHEF)
    // Excludes client users
    const notifiedCount = this.connectionManager.sendToStaffRoles(message);

    return { notified: notifiedCount > 0, notifiedCount };
  }
}

