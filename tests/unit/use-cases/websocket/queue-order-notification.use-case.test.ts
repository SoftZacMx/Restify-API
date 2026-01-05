import { QueueOrderNotificationUseCase } from '../../../../src/core/application/use-cases/websocket/queue-order-notification.use-case';
import { SQSService } from '../../../../src/core/infrastructure/queue/sqs.service';
import { OrderNotificationType } from '../../../../src/core/application/use-cases/websocket/notify-order-status.use-case';

describe('QueueOrderNotificationUseCase', () => {
  let queueOrderNotificationUseCase: QueueOrderNotificationUseCase;
  let mockSQSService: jest.Mocked<SQSService>;

  beforeEach(() => {
    mockSQSService = {
      sendOrderNotification: jest.fn(),
      receiveOrderMessages: jest.fn(),
      deleteOrderMessage: jest.fn(),
      sendPaymentNotification: jest.fn(),
      receiveMessages: jest.fn(),
      deleteMessage: jest.fn(),
    } as any;

    queueOrderNotificationUseCase = new QueueOrderNotificationUseCase(mockSQSService);
  });

  describe('execute', () => {
    it('should queue order notification successfully', async () => {
      mockSQSService.sendOrderNotification.mockResolvedValue(undefined);

      const result = await queueOrderNotificationUseCase.execute({
        orderId: 'order-123',
        notificationType: OrderNotificationType.CREATED,
        orderData: {
          id: 'order-123',
          status: false,
          total: 100.0,
          subtotal: 86.21,
          delivered: false,
        },
      });

      expect(result.queued).toBe(true);
      expect(mockSQSService.sendOrderNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 'order-123',
          notificationType: OrderNotificationType.CREATED,
          orderData: expect.objectContaining({
            id: 'order-123',
            status: false,
            total: 100.0,
          }),
        })
      );
    });

    it('should queue notification for order update', async () => {
      mockSQSService.sendOrderNotification.mockResolvedValue(undefined);

      const result = await queueOrderNotificationUseCase.execute({
        orderId: 'order-123',
        notificationType: OrderNotificationType.UPDATED,
      });

      expect(result.queued).toBe(true);
      expect(mockSQSService.sendOrderNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 'order-123',
          notificationType: OrderNotificationType.UPDATED,
        })
      );
    });

    it('should queue notification for order delivered', async () => {
      mockSQSService.sendOrderNotification.mockResolvedValue(undefined);

      const result = await queueOrderNotificationUseCase.execute({
        orderId: 'order-123',
        notificationType: OrderNotificationType.DELIVERED,
        orderData: {
          id: 'order-123',
          delivered: true,
        },
      });

      expect(result.queued).toBe(true);
      expect(mockSQSService.sendOrderNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 'order-123',
          notificationType: OrderNotificationType.DELIVERED,
        })
      );
    });

    it('should queue notification for order canceled', async () => {
      mockSQSService.sendOrderNotification.mockResolvedValue(undefined);

      const result = await queueOrderNotificationUseCase.execute({
        orderId: 'order-123',
        notificationType: OrderNotificationType.CANCELED,
      });

      expect(result.queued).toBe(true);
      expect(mockSQSService.sendOrderNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 'order-123',
          notificationType: OrderNotificationType.CANCELED,
        })
      );
    });

    it('should return queued: false if SQS service fails', async () => {
      mockSQSService.sendOrderNotification.mockRejectedValue(new Error('SQS error'));

      const result = await queueOrderNotificationUseCase.execute({
        orderId: 'order-123',
        notificationType: OrderNotificationType.CREATED,
      });

      expect(result.queued).toBe(false);
      expect(mockSQSService.sendOrderNotification).toHaveBeenCalled();
    });

    it('should convert Date to ISO string in orderData', async () => {
      mockSQSService.sendOrderNotification.mockResolvedValue(undefined);
      const testDate = new Date('2024-01-01T00:00:00Z');

      await queueOrderNotificationUseCase.execute({
        orderId: 'order-123',
        notificationType: OrderNotificationType.CREATED,
        orderData: {
          id: 'order-123',
          date: testDate,
        },
      });

      expect(mockSQSService.sendOrderNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          orderData: expect.objectContaining({
            date: testDate.toISOString(),
          }),
        })
      );
    });
  });
});

