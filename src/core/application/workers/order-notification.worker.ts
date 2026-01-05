import { inject, injectable } from 'tsyringe';
import { SQSService } from '../../infrastructure/queue/sqs.service';
import { NotifyOrderStatusUseCase, OrderNotificationType } from '../use-cases/websocket/notify-order-status.use-case';

/**
 * Worker that processes order notifications from SQS queue
 * Uses Long Polling to reduce AWS API calls and costs
 * 
 * Cost optimization:
 * - Long Polling (WaitTimeSeconds: 20) reduces API calls by ~75%
 * - Without messages: ~3 requests/min = 4,320 requests/day (FREE tier: 1M requests/month)
 * - With messages: Processes immediately, no waiting
 */
@injectable()
export class OrderNotificationWorker {
  private isRunning: boolean = false;
  private processingPromise: Promise<void> | null = null;
  private consecutiveErrors: number = 0;
  private readonly MAX_CONSECUTIVE_ERRORS = 5;

  constructor(
    @inject(SQSService) private readonly sqsService: SQSService,
    @inject(NotifyOrderStatusUseCase) private readonly notifyOrderStatusUseCase: NotifyOrderStatusUseCase
  ) {}

  /**
   * Start the worker to process notifications
   * Uses continuous processing with Long Polling (no fixed interval)
   * This reduces AWS API calls significantly compared to fixed-interval polling
   */
  start(): void {
    if (this.isRunning) {
      console.log('[OrderNotificationWorker] Worker is already running');
      return;
    }

    this.isRunning = true;
    console.log('[OrderNotificationWorker] Starting worker with Long Polling (cost-optimized)...');

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
    console.log('[OrderNotificationWorker] Worker stopped');
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
          console.error(`[OrderNotificationWorker] Too many consecutive errors (${this.consecutiveErrors}). Waiting 30 seconds before retry...`);
          if (this.isRunning) {
            await new Promise((resolve) => setTimeout(resolve, 30000));
            this.consecutiveErrors = 0; // Reset after long wait
          }
        } else {
          // Exponential backoff: 1s, 2s, 4s, 8s, 16s
          const waitTime = Math.min(1000 * Math.pow(2, this.consecutiveErrors - 1), 16000);
          console.error(`[OrderNotificationWorker] Error in processing loop (attempt ${this.consecutiveErrors}/${this.MAX_CONSECUTIVE_ERRORS}):`, errorMessage);
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
      const messages = await this.sqsService.receiveOrderMessages(10);

      if (messages.length === 0) {
        return; // No messages to process
      }

      console.log(`[OrderNotificationWorker] Processing ${messages.length} notification(s)`);

      // Process messages in parallel
      const processingPromises = messages.map(async (msg) => {
        try {
          // Map SQS message notificationType to OrderNotificationType enum
          const notificationType = this.mapStringToOrderNotificationType(msg.body.notificationType);

          // Attempt to notify via WebSocket
          const result = await this.notifyOrderStatusUseCase.execute({
            orderId: msg.body.orderId,
            notificationType,
            orderData: msg.body.orderData
              ? {
                  ...msg.body.orderData,
                  date: msg.body.orderData.date ? new Date(msg.body.orderData.date) : undefined,
                }
              : undefined,
          });

          if (result.notified) {
            // Successfully notified, delete message from queue
            await this.sqsService.deleteOrderMessage(msg.receiptHandle);
            console.log(`[OrderNotificationWorker] Notification delivered: ${msg.body.orderId} (${msg.body.notificationType})`);
          } else {
            // Staff not connected, message will be retried by SQS
            // SQS will make the message visible again after visibility timeout
            console.log(`[OrderNotificationWorker] Staff not connected, will retry: ${msg.body.orderId}`);
            // Don't delete message - let SQS handle retry
          }
        } catch (error) {
          console.error(`[OrderNotificationWorker] Error processing message ${msg.messageId}:`, error);
          // Don't delete message on error - let SQS handle retry
        }
      });

      await Promise.allSettled(processingPromises);
    } catch (error) {
      console.error('[OrderNotificationWorker] Error processing queue:', error);
    }
  }

  /**
   * Map string notificationType to OrderNotificationType enum
   */
  private mapStringToOrderNotificationType(notificationType: string): OrderNotificationType {
    const typeMap: Record<string, OrderNotificationType> = {
      created: OrderNotificationType.CREATED,
      updated: OrderNotificationType.UPDATED,
      delivered: OrderNotificationType.DELIVERED,
      canceled: OrderNotificationType.CANCELED,
    };

    return typeMap[notificationType] || OrderNotificationType.UPDATED;
  }

  /**
   * Check if worker is running
   */
  isWorkerRunning(): boolean {
    return this.isRunning;
  }
}

