import { SQSClient, SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import { injectable } from 'tsyringe';

export interface SQSMessage {
  paymentId: string;
  status: string;
  orderId?: string | null;
  error?: string;
  timestamp: Date;
}

export interface OrderNotificationSQSMessage {
  orderId: string;
  notificationType: string; // 'created', 'updated', 'delivered', 'canceled'
  orderData?: {
    id: string;
    date?: string;
    status?: boolean;
    total?: number;
    subtotal?: number;
    delivered?: boolean;
    tableId?: string | null;
    origin?: string;
    client?: string | null;
  };
  timestamp: Date;
}

@injectable()
export class SQSService {
  private client: SQSClient;
  private notificationsQueueUrl: string;
  private orderNotificationsQueueUrl: string;

  constructor() {
    const endpoint = process.env.AWS_ENDPOINT_URL;
    const region = process.env.AWS_REGION || 'us-east-1';

    this.client = new SQSClient({
      region,
      endpoint: endpoint || undefined, // Use endpoint for LocalStack, undefined for AWS
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
      },
    });

    this.notificationsQueueUrl =
      process.env.PAYMENT_NOTIFICATIONS_QUEUE_URL ||
      'http://localhost:4566/000000000000/payment-notifications-queue';

    this.orderNotificationsQueueUrl =
      process.env.ORDER_NOTIFICATIONS_QUEUE_URL ||
      'http://localhost:4566/000000000000/order-notifications-queue';
  }

  /**
   * Send payment notification message to SQS queue
   */
  async sendPaymentNotification(message: SQSMessage): Promise<void> {
    try {
      const command = new SendMessageCommand({
        QueueUrl: this.notificationsQueueUrl,
        MessageBody: JSON.stringify({
          ...message,
          timestamp: message.timestamp.toISOString(),
        }),
        MessageAttributes: {
          paymentId: {
            DataType: 'String',
            StringValue: message.paymentId,
          },
          status: {
            DataType: 'String',
            StringValue: message.status,
          },
        },
      });

      await this.client.send(command);
    } catch (error) {
      console.error('[SQS] Error sending payment notification:', error);
      throw error;
    }
  }

  /**
   * Receive messages from the queue (for workers)
   */
  async receiveMessages(maxMessages: number = 10): Promise<Array<{ messageId: string; receiptHandle: string; body: SQSMessage }>> {
    try {
      const command = new ReceiveMessageCommand({
        QueueUrl: this.notificationsQueueUrl,
        MaxNumberOfMessages: maxMessages,
        WaitTimeSeconds: 20, // Long polling
        MessageAttributeNames: ['All'],
      });

      const response = await this.client.send(command);

      if (!response.Messages || response.Messages.length === 0) {
        return [];
      }

      return response.Messages.map((msg) => ({
        messageId: msg.MessageId || '',
        receiptHandle: msg.ReceiptHandle || '',
        body: JSON.parse(msg.Body || '{}') as SQSMessage,
      }));
    } catch (error) {
      console.error('[SQS] Error receiving messages:', error);
      throw error;
    }
  }

  /**
   * Delete a message from the queue after processing
   */
  async deleteMessage(receiptHandle: string): Promise<void> {
    try {
      const command = new DeleteMessageCommand({
        QueueUrl: this.notificationsQueueUrl,
        ReceiptHandle: receiptHandle,
      });

      await this.client.send(command);
    } catch (error) {
      console.error('[SQS] Error deleting message:', error);
      throw error;
    }
  }

  /**
   * Send order notification message to SQS queue
   */
  async sendOrderNotification(message: OrderNotificationSQSMessage): Promise<void> {
    try {
      const command = new SendMessageCommand({
        QueueUrl: this.orderNotificationsQueueUrl,
        MessageBody: JSON.stringify({
          ...message,
          timestamp: message.timestamp.toISOString(),
        }),
        MessageAttributes: {
          orderId: {
            DataType: 'String',
            StringValue: message.orderId,
          },
          notificationType: {
            DataType: 'String',
            StringValue: message.notificationType,
          },
        },
      });

      await this.client.send(command);
    } catch (error) {
      console.error('[SQS] Error sending order notification:', error);
      throw error;
    }
  }

  /**
   * Receive order notification messages from the queue (for workers)
   */
  async receiveOrderMessages(maxMessages: number = 10): Promise<Array<{ messageId: string; receiptHandle: string; body: OrderNotificationSQSMessage }>> {
    try {
      const command = new ReceiveMessageCommand({
        QueueUrl: this.orderNotificationsQueueUrl,
        MaxNumberOfMessages: maxMessages,
        WaitTimeSeconds: 20, // Long polling
        MessageAttributeNames: ['All'],
      });

      const response = await this.client.send(command);

      if (!response.Messages || response.Messages.length === 0) {
        return [];
      }

      return response.Messages.map((msg) => ({
        messageId: msg.MessageId || '',
        receiptHandle: msg.ReceiptHandle || '',
        body: JSON.parse(msg.Body || '{}') as OrderNotificationSQSMessage,
      }));
    } catch (error) {
      console.error('[SQS] Error receiving order messages:', error);
      throw error;
    }
  }

  /**
   * Delete an order notification message from the queue after processing
   */
  async deleteOrderMessage(receiptHandle: string): Promise<void> {
    try {
      const command = new DeleteMessageCommand({
        QueueUrl: this.orderNotificationsQueueUrl,
        ReceiptHandle: receiptHandle,
      });

      await this.client.send(command);
    } catch (error) {
      console.error('[SQS] Error deleting order message:', error);
      throw error;
    }
  }
}

