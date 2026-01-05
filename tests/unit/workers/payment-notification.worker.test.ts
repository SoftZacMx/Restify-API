import { PaymentNotificationWorker } from '../../../src/core/application/workers/payment-notification.worker';
import { SQSService } from '../../../src/core/infrastructure/queue/sqs.service';
import { NotifyPaymentStatusUseCase } from '../../../src/core/application/use-cases/websocket/notify-payment-status.use-case';
import { PaymentStatus } from '@prisma/client';

describe('PaymentNotificationWorker', () => {
  let worker: PaymentNotificationWorker;
  let mockSQSService: jest.Mocked<SQSService>;
  let mockNotifyUseCase: jest.Mocked<NotifyPaymentStatusUseCase>;

  beforeEach(() => {
    mockSQSService = {
      sendPaymentNotification: jest.fn(),
      receiveMessages: jest.fn(),
      deleteMessage: jest.fn(),
    } as any;

    mockNotifyUseCase = {
      execute: jest.fn(),
    } as any;

    worker = new PaymentNotificationWorker(mockSQSService, mockNotifyUseCase);
  });

  afterEach(() => {
    if (worker.isWorkerRunning()) {
      worker.stop();
    }
  });

  describe('start', () => {
    it('should start the worker', () => {
      mockSQSService.receiveMessages.mockResolvedValue([]);

      worker.start();

      expect(worker.isWorkerRunning()).toBe(true);
    });

    it('should not start if already running', () => {
      mockSQSService.receiveMessages.mockResolvedValue([]);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      worker.start();
      worker.start(); // Try to start again

      expect(consoleSpy).toHaveBeenCalledWith('[PaymentNotificationWorker] Worker is already running');
      consoleSpy.mockRestore();
    });
  });

  describe('stop', () => {
    it('should stop the worker', () => {
      mockSQSService.receiveMessages.mockResolvedValue([]);
      worker.start();

      worker.stop();

      expect(worker.isWorkerRunning()).toBe(false);
    });

    it('should handle stopping when not running', () => {
      expect(() => worker.stop()).not.toThrow();
    });
  });

  describe('processQueue', () => {
    it('should process messages and notify successfully', async () => {
      const messages = [
        {
          messageId: 'msg-1',
          receiptHandle: 'receipt-1',
          body: {
            paymentId: 'payment-123',
            status: 'SUCCEEDED',
            orderId: 'order-123',
            timestamp: new Date(),
          },
        },
      ];

      mockSQSService.receiveMessages.mockResolvedValue(messages);
      mockNotifyUseCase.execute.mockResolvedValue({ notified: true });

      // Call processQueue directly instead of starting worker
      // @ts-ignore - accessing private method for testing
      await worker.processQueue();

      expect(mockSQSService.receiveMessages).toHaveBeenCalled();
      expect(mockNotifyUseCase.execute).toHaveBeenCalledWith({
        paymentId: 'payment-123',
        status: PaymentStatus.SUCCEEDED,
        orderId: 'order-123',
      });
      expect(mockSQSService.deleteMessage).toHaveBeenCalledWith('receipt-1');
    });

    it('should not delete message if client not connected', async () => {
      const messages = [
        {
          messageId: 'msg-1',
          receiptHandle: 'receipt-1',
          body: {
            paymentId: 'payment-123',
            status: 'SUCCEEDED',
            timestamp: new Date(),
          },
        },
      ];

      mockSQSService.receiveMessages.mockResolvedValue(messages);
      mockNotifyUseCase.execute.mockResolvedValue({ notified: false }); // Client not connected

      // @ts-ignore - accessing private method for testing
      await worker.processQueue();

      expect(mockNotifyUseCase.execute).toHaveBeenCalled();
      expect(mockSQSService.deleteMessage).not.toHaveBeenCalled(); // Message stays in queue for retry
    });

    it('should handle errors gracefully', async () => {
      mockSQSService.receiveMessages.mockRejectedValue(new Error('SQS error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // @ts-ignore - accessing private method for testing
      await worker.processQueue();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle empty queue', async () => {
      mockSQSService.receiveMessages.mockResolvedValue([]);

      // @ts-ignore - accessing private method for testing
      await worker.processQueue();

      expect(mockNotifyUseCase.execute).not.toHaveBeenCalled();
      expect(mockSQSService.deleteMessage).not.toHaveBeenCalled();
    });

    it('should map string status to PaymentStatus enum correctly', async () => {
      const messages = [
        {
          messageId: 'msg-1',
          receiptHandle: 'receipt-1',
          body: {
            paymentId: 'payment-123',
            status: 'FAILED',
            timestamp: new Date(),
          },
        },
      ];

      mockSQSService.receiveMessages.mockResolvedValue(messages);
      mockNotifyUseCase.execute.mockResolvedValue({ notified: true });

      // @ts-ignore - accessing private method for testing
      await worker.processQueue();

      expect(mockNotifyUseCase.execute).toHaveBeenCalledWith({
        paymentId: 'payment-123',
        status: PaymentStatus.FAILED,
        orderId: undefined,
        error: undefined,
      });
    });
  });
});

