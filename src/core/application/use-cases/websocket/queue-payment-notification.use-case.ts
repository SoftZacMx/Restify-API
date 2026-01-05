import { inject, injectable } from 'tsyringe';
import { SQSService } from '../../../infrastructure/queue/sqs.service';
import { PaymentStatus } from '@prisma/client';

export interface QueuePaymentNotificationInput {
  paymentId: string;
  status: PaymentStatus;
  orderId?: string | null;
  error?: string;
}

/**
 * Use case to queue payment notifications via SQS
 * This decouples payment processing from notification delivery
 */
@injectable()
export class QueuePaymentNotificationUseCase {
  constructor(@inject(SQSService) private readonly sqsService: SQSService) {}

  async execute(input: QueuePaymentNotificationInput): Promise<{ queued: boolean }> {
    try {
      await this.sqsService.sendPaymentNotification({
        paymentId: input.paymentId,
        status: input.status,
        orderId: input.orderId,
        error: input.error,
        timestamp: new Date(),
      });

      return { queued: true };
    } catch (error) {
      console.error('[QueuePaymentNotification] Error queueing notification:', error);
      // Don't throw - we don't want to fail payment processing if queueing fails
      return { queued: false };
    }
  }
}

