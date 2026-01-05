import { OrderNotificationWorker } from '../../../src/core/application/workers/order-notification.worker';
import { SQSService } from '../../../src/core/infrastructure/queue/sqs.service';
import { NotifyOrderStatusUseCase } from '../../../src/core/application/use-cases/websocket/notify-order-status.use-case';
import { OrderNotificationType } from '../../../src/core/application/use-cases/websocket/notify-order-status.use-case';

describe('OrderNotificationWorker', () => {
  let worker: OrderNotificationWorker;
  let mockSQSService: jest.Mocked<SQSService>;
  let mockNotifyUseCase: jest.Mocked<NotifyOrderStatusUseCase>;

  beforeEach(() => {
    mockSQSService = {
      sendOrderNotification: jest.fn(),
      receiveOrderMessages: jest.fn(),
      deleteOrderMessage: jest.fn(),
      sendPaymentNotification: jest.fn(),
      receiveMessages: jest.fn(),
      deleteMessage: jest.fn(),
    } as any;

    mockNotifyUseCase = {
      execute: jest.fn(),
    } as any;

    worker = new OrderNotificationWorker(mockSQSService, mockNotifyUseCase);
  });

  afterEach(() => {
    if (worker.isWorkerRunning()) {
      worker.stop();
    }
  });

  describe('start', () => {
    it('should start the worker', () => {
      mockSQSService.receiveOrderMessages.mockResolvedValue([]);

      worker.start();

      expect(worker.isWorkerRunning()).toBe(true);
    });

    it('should not start if already running', () => {
      mockSQSService.receiveOrderMessages.mockResolvedValue([]);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      worker.start();
      worker.start(); // Try to start again

      expect(consoleSpy).toHaveBeenCalledWith('[OrderNotificationWorker] Worker is already running');
      consoleSpy.mockRestore();
    });
  });

  describe('stop', () => {
    it('should stop the worker', () => {
      mockSQSService.receiveOrderMessages.mockResolvedValue([]);
      worker.start();

      worker.stop();

      expect(worker.isWorkerRunning()).toBe(false);
    });

    it('should handle stopping when not running', () => {
      expect(() => worker.stop()).not.toThrow();
    });
  });

  describe('processQueue', () => {
    it('should process order notification messages and delete on success', async () => {
      const mockMessage = {
        messageId: 'msg-123',
        receiptHandle: 'receipt-123',
        body: {
          orderId: 'order-123',
          notificationType: 'created',
          orderData: {
            id: 'order-123',
            status: false,
            total: 100.0,
          },
          timestamp: new Date(),
        },
      };

      mockSQSService.receiveOrderMessages.mockResolvedValue([mockMessage]);
      mockNotifyUseCase.execute.mockResolvedValue({ notified: true, notifiedCount: 2 });
      mockSQSService.deleteOrderMessage.mockResolvedValue(undefined);

      // Start worker and wait a bit for processing
      worker.start();
      await new Promise((resolve) => setTimeout(resolve, 100));
      worker.stop();

      expect(mockSQSService.receiveOrderMessages).toHaveBeenCalled();
      expect(mockNotifyUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 'order-123',
          notificationType: OrderNotificationType.CREATED,
        })
      );
      expect(mockSQSService.deleteOrderMessage).toHaveBeenCalledWith('receipt-123');
    });

    it('should not delete message if notification fails', async () => {
      const mockMessage = {
        messageId: 'msg-123',
        receiptHandle: 'receipt-123',
        body: {
          orderId: 'order-123',
          notificationType: 'updated',
          timestamp: new Date(),
        },
      };

      mockSQSService.receiveOrderMessages.mockResolvedValue([mockMessage]);
      mockNotifyUseCase.execute.mockResolvedValue({ notified: false, notifiedCount: 0 });

      worker.start();
      await new Promise((resolve) => setTimeout(resolve, 100));
      worker.stop();

      expect(mockNotifyUseCase.execute).toHaveBeenCalled();
      expect(mockSQSService.deleteOrderMessage).not.toHaveBeenCalled();
    });

    it('should handle multiple notification types correctly', async () => {
      const messages = [
        {
          messageId: 'msg-1',
          receiptHandle: 'receipt-1',
          body: {
            orderId: 'order-1',
            notificationType: 'created',
            timestamp: new Date(),
          },
        },
        {
          messageId: 'msg-2',
          receiptHandle: 'receipt-2',
          body: {
            orderId: 'order-2',
            notificationType: 'delivered',
            timestamp: new Date(),
          },
        },
        {
          messageId: 'msg-3',
          receiptHandle: 'receipt-3',
          body: {
            orderId: 'order-3',
            notificationType: 'canceled',
            timestamp: new Date(),
          },
        },
      ];

      mockSQSService.receiveOrderMessages.mockResolvedValue(messages);
      mockNotifyUseCase.execute.mockResolvedValue({ notified: true, notifiedCount: 1 });

      worker.start();
      await new Promise((resolve) => setTimeout(resolve, 100));
      worker.stop();

      expect(mockNotifyUseCase.execute).toHaveBeenCalledTimes(3);
      expect(mockNotifyUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({ notificationType: OrderNotificationType.CREATED })
      );
      expect(mockNotifyUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({ notificationType: OrderNotificationType.DELIVERED })
      );
      expect(mockNotifyUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({ notificationType: OrderNotificationType.CANCELED })
      );
    });
  });
});

