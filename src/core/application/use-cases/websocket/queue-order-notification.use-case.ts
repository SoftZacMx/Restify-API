import { inject, injectable } from 'tsyringe';
import { SQSService } from '../../../infrastructure/queue/sqs.service';
import { OrderNotificationType } from './notify-order-status.use-case';

export interface QueueOrderNotificationInput {
  orderId: string;
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

/**
 * Use case to queue order notifications via SQS
 * This decouples order processing from notification delivery
 * Ensures notifications are delivered even if staff members are temporarily disconnected
 */
@injectable()
export class QueueOrderNotificationUseCase {
  constructor(@inject(SQSService) private readonly sqsService: SQSService) {}

  async execute(input: QueueOrderNotificationInput): Promise<{ queued: boolean }> {
    try {
      await this.sqsService.sendOrderNotification({
        orderId: input.orderId,
        notificationType: input.notificationType,
        orderData: input.orderData
          ? {
              ...input.orderData,
              date: input.orderData.date?.toISOString(),
            }
          : undefined,
        timestamp: new Date(),
      });

      return { queued: true };
    } catch (error) {
      console.error('[QueueOrderNotification] Error queueing notification:', error);
      // Don't throw - we don't want to fail order processing if queueing fails
      return { queued: false };
    }
  }
}

