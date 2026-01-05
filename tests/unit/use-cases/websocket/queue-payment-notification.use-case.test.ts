import { QueuePaymentNotificationUseCase } from '../../../../src/core/application/use-cases/websocket/queue-payment-notification.use-case';
import { SQSService } from '../../../../src/core/infrastructure/queue/sqs.service';
import { PaymentStatus } from '@prisma/client';

describe('QueuePaymentNotificationUseCase', () => {
  let queuePaymentNotificationUseCase: QueuePaymentNotificationUseCase;
  let mockSQSService: jest.Mocked<SQSService>;

  beforeEach(() => {
    mockSQSService = {
      sendPaymentNotification: jest.fn(),
      receiveMessages: jest.fn(),
      deleteMessage: jest.fn(),
    } as any;

    queuePaymentNotificationUseCase = new QueuePaymentNotificationUseCase(mockSQSService);
  });

  describe('execute', () => {
    it('should queue payment notification successfully', async () => {
      mockSQSService.sendPaymentNotification.mockResolvedValue(undefined);

      const result = await queuePaymentNotificationUseCase.execute({
        paymentId: 'payment-123',
        status: PaymentStatus.SUCCEEDED,
        orderId: 'order-123',
      });

      expect(result.queued).toBe(true);
      expect(mockSQSService.sendPaymentNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentId: 'payment-123',
          status: PaymentStatus.SUCCEEDED,
          orderId: 'order-123',
        })
      );
    });

    it('should queue notification with error message for failed payments', async () => {
      mockSQSService.sendPaymentNotification.mockResolvedValue(undefined);

      const result = await queuePaymentNotificationUseCase.execute({
        paymentId: 'payment-123',
        status: PaymentStatus.FAILED,
        error: 'Payment failed',
      });

      expect(result.queued).toBe(true);
      expect(mockSQSService.sendPaymentNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentId: 'payment-123',
          status: PaymentStatus.FAILED,
          error: 'Payment failed',
        })
      );
    });

    it('should return queued: false if SQS service fails', async () => {
      mockSQSService.sendPaymentNotification.mockRejectedValue(new Error('SQS error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await queuePaymentNotificationUseCase.execute({
        paymentId: 'payment-123',
        status: PaymentStatus.SUCCEEDED,
      });

      expect(result.queued).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should not throw error if queueing fails', async () => {
      mockSQSService.sendPaymentNotification.mockRejectedValue(new Error('SQS error'));

      await expect(
        queuePaymentNotificationUseCase.execute({
          paymentId: 'payment-123',
          status: PaymentStatus.SUCCEEDED,
        })
      ).resolves.toEqual({ queued: false });
    });
  });
});

