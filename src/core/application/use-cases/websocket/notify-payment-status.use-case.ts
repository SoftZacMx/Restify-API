import { inject, injectable } from 'tsyringe';
import { IWebSocketConnectionManager } from '../../../domain/interfaces/websocket-connection.interface';
import { IPaymentSessionRepository } from '../../../domain/interfaces/payment-session-repository.interface';
import { WebSocketEventType, WebSocketMessage } from '../../../domain/interfaces/websocket-connection.interface';
import { PaymentStatus } from '@prisma/client';

export interface NotifyPaymentStatusInput {
  paymentId: string;
  status: PaymentStatus;
  orderId?: string | null;
  error?: string;
}

@injectable()
export class NotifyPaymentStatusUseCase {
  constructor(
    @inject('IWebSocketConnectionManager')
    private readonly connectionManager: IWebSocketConnectionManager,
    @inject('IPaymentSessionRepository')
    private readonly paymentSessionRepository: IPaymentSessionRepository
  ) {}

  async execute(input: NotifyPaymentStatusInput): Promise<{ notified: boolean }> {
    // 1. Find payment session by paymentId
    const session = await this.paymentSessionRepository.findByPaymentId(input.paymentId);

    if (!session || !session.connectionId) {
      // No WebSocket connection associated with this payment
      return { notified: false };
    }

    // 2. Determine event type based on status
    let eventType: WebSocketEventType;
    let messageData: any;

    switch (input.status) {
      case PaymentStatus.SUCCEEDED:
        eventType = WebSocketEventType.PAYMENT_CONFIRMED;
        messageData = {
          paymentId: input.paymentId,
          orderId: input.orderId,
          status: 'succeeded',
          message: 'Payment confirmed successfully',
        };
        break;

      case PaymentStatus.FAILED:
        eventType = WebSocketEventType.PAYMENT_FAILED;
        messageData = {
          paymentId: input.paymentId,
          orderId: input.orderId,
          status: 'failed',
          error: input.error || 'Payment failed',
          message: 'Payment could not be processed',
        };
        break;

      case PaymentStatus.PENDING:
      case PaymentStatus.PROCESSING:
        eventType = WebSocketEventType.PAYMENT_PENDING;
        messageData = {
          paymentId: input.paymentId,
          orderId: input.orderId,
          status: 'pending',
          message: 'Payment is being processed',
        };
        break;

      default:
        // For other statuses, don't send notification
        return { notified: false };
    }

    // 3. Create WebSocket message
    const message: WebSocketMessage = {
      type: eventType,
      data: messageData,
      timestamp: new Date(),
      connectionId: session.connectionId,
    };

    // 4. Send notification via WebSocket
    const sent = this.connectionManager.sendToConnection(session.connectionId, message);

    return { notified: sent };
  }
}

