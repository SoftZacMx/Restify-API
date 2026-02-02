import { inject, injectable } from 'tsyringe';
import { SQSService } from '../../infrastructure/queue/sqs.service';
import { NotifyPaymentStatusUseCase } from '../use-cases/websocket/notify-payment-status.use-case';
import { PaymentStatus } from '@prisma/client';

/**
 * Worker that processes payment notifications from SQS queue
 * Uses Long Polling to reduce AWS API calls and costs
 * 
 * Cost optimization:
 * - Long Polling (WaitTimeSeconds: 20) reduces API calls by ~75%
 * - Without messages: ~3 requests/min = 4,320 requests/day (FREE tier: 1M requests/month)
 * - With messages: Processes immediately, no waiting
 */
@injectable()
export class PaymentNotificationWorker {
  private isRunning: boolean = false;
  private processingPromise: Promise<void> | null = null;
  private consecutiveErrors: number = 0;
  private readonly MAX_CONSECUTIVE_ERRORS = 5;

  constructor(
    @inject(SQSService) private readonly sqsService: SQSService,
    @inject(NotifyPaymentStatusUseCase) private readonly notifyPaymentStatusUseCase: NotifyPaymentStatusUseCase
  ) {}

  /**
   * Start the worker to process notifications
   * Uses continuous processing with Long Polling (no fixed interval)
   * This reduces AWS API calls significantly compared to fixed-interval polling
   */
  start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    // Start continuous processing (no interval - uses Long Polling instead)
    this.startContinuousProcessing();
  }

  /**
   * Stop the worker
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
  }

  /**
   * Start continuous processing loop
   * Uses Long Polling: waits up to 20 seconds for messages
   * If no messages, waits the full 20s (reducing API calls)
   * If messages arrive, processes immediately and continues
   */
  private async startContinuousProcessing(): Promise<void> {
    while (this.isRunning) {
      try {
        await this.processQueue();
        // Reset error counter on success
        this.consecutiveErrors = 0;
        // After processing, immediately start next poll (Long Polling handles the wait)
        // No need for setTimeout - Long Polling already waits up to 20 seconds
      } catch (error) {
        this.consecutiveErrors++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // If too many consecutive errors, wait longer before retrying
        if (this.consecutiveErrors >= this.MAX_CONSECUTIVE_ERRORS) {
          console.error(`[PaymentNotificationWorker] Too many consecutive errors (${this.consecutiveErrors}). Waiting 30 seconds before retry...`);
          if (this.isRunning) {
            await new Promise((resolve) => setTimeout(resolve, 30000));
            this.consecutiveErrors = 0; // Reset after long wait
          }
        } else {
          // Exponential backoff: 1s, 2s, 4s, 8s, 16s
          const waitTime = Math.min(1000 * Math.pow(2, this.consecutiveErrors - 1), 16000);
          console.error(`[PaymentNotificationWorker] Error in processing loop (attempt ${this.consecutiveErrors}/${this.MAX_CONSECUTIVE_ERRORS}):`, errorMessage);
          if (this.isRunning) {
            await new Promise((resolve) => setTimeout(resolve, waitTime));
          }
        }
      }
    }
  }

  /**
   * Process messages from the queue
   */
  private async processQueue(): Promise<void> {
    try {
      const messages = await this.sqsService.receiveMessages(10);

      if (messages.length === 0) {
        return; // No messages to process
      }

      // Process messages in parallel
      const processingPromises = messages.map(async (msg) => {
        try {
          // Map SQS message status to PaymentStatus enum
          const paymentStatus = this.mapStringToPaymentStatus(msg.body.status);

          // Attempt to notify via WebSocket
          const result = await this.notifyPaymentStatusUseCase.execute({
            paymentId: msg.body.paymentId,
            status: paymentStatus,
            orderId: msg.body.orderId,
            error: msg.body.error,
          });

          if (result.notified) {
            // Successfully notified, delete message from queue
            await this.sqsService.deleteMessage(msg.receiptHandle);
          } else {
            // Client not connected, message will be retried by SQS
            // Don't delete message - let SQS handle retry
          }
        } catch (error) {
          console.error(`[PaymentNotificationWorker] Error processing message ${msg.messageId}:`, error);
          // Don't delete message on error - let SQS handle retry
        }
      });

      await Promise.allSettled(processingPromises);
    } catch (error) {
      console.error('[PaymentNotificationWorker] Error processing queue:', error);
    }
  }

  /**
   * Map string status to PaymentStatus enum
   */
  private mapStringToPaymentStatus(status: string): PaymentStatus {
    const statusMap: Record<string, PaymentStatus> = {
      PENDING: PaymentStatus.PENDING,
      PROCESSING: PaymentStatus.PROCESSING,
      SUCCEEDED: PaymentStatus.SUCCEEDED,
      FAILED: PaymentStatus.FAILED,
      CANCELED: PaymentStatus.CANCELED,
      REFUNDED: PaymentStatus.REFUNDED,
      PARTIALLY_REFUNDED: PaymentStatus.PARTIALLY_REFUNDED,
      REQUIRES_ACTION: PaymentStatus.REQUIRES_ACTION,
    };

    return statusMap[status] || PaymentStatus.PENDING;
  }

  /**
   * Check if worker is running
   */
  isWorkerRunning(): boolean {
    return this.isRunning;
  }
}

