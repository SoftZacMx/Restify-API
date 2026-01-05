import { SQSService, SQSMessage } from '../../../src/core/infrastructure/queue/sqs.service';
import { SQSClient, SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';

// Mock AWS SDK
jest.mock('@aws-sdk/client-sqs', () => ({
  SQSClient: jest.fn(),
  SendMessageCommand: jest.fn(),
  ReceiveMessageCommand: jest.fn(),
  DeleteMessageCommand: jest.fn(),
}));

describe('SQSService', () => {
  let sqsService: SQSService;
  let mockSend: jest.Mock;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.AWS_ENDPOINT_URL = 'http://localhost:4566';
    process.env.AWS_REGION = 'us-east-1';
    process.env.AWS_ACCESS_KEY_ID = 'test';
    process.env.AWS_SECRET_ACCESS_KEY = 'test';
    process.env.PAYMENT_NOTIFICATIONS_QUEUE_URL = 'http://localhost:4566/000000000000/payment-notifications-queue';

    mockSend = jest.fn();
    (SQSClient as jest.Mock).mockImplementation(() => ({
      send: mockSend,
    }));

    sqsService = new SQSService();
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  describe('sendPaymentNotification', () => {
    it('should send message to SQS queue', async () => {
      const message: SQSMessage = {
        paymentId: 'payment-123',
        status: 'SUCCEEDED',
        orderId: 'order-123',
        timestamp: new Date(),
      };

      mockSend.mockResolvedValue({});

      await sqsService.sendPaymentNotification(message);

      expect(SendMessageCommand).toHaveBeenCalledWith({
        QueueUrl: 'http://localhost:4566/000000000000/payment-notifications-queue',
        MessageBody: expect.stringContaining('payment-123'),
        MessageAttributes: {
          paymentId: {
            DataType: 'String',
            StringValue: 'payment-123',
          },
          status: {
            DataType: 'String',
            StringValue: 'SUCCEEDED',
          },
        },
      });
      expect(mockSend).toHaveBeenCalled();
    });

    it('should handle errors when sending message', async () => {
      const message: SQSMessage = {
        paymentId: 'payment-123',
        status: 'SUCCEEDED',
        timestamp: new Date(),
      };

      const error = new Error('SQS error');
      mockSend.mockRejectedValue(error);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(sqsService.sendPaymentNotification(message)).rejects.toThrow('SQS error');
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('receiveMessages', () => {
    it('should receive messages from queue', async () => {
      const mockMessages = [
        {
          MessageId: 'msg-1',
          ReceiptHandle: 'receipt-1',
          Body: JSON.stringify({
            paymentId: 'payment-123',
            status: 'SUCCEEDED',
            timestamp: new Date().toISOString(),
          }),
        },
      ];

      mockSend.mockResolvedValue({
        Messages: mockMessages,
      });

      const messages = await sqsService.receiveMessages(10);

      expect(ReceiveMessageCommand).toHaveBeenCalledWith({
        QueueUrl: 'http://localhost:4566/000000000000/payment-notifications-queue',
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 20,
        MessageAttributeNames: ['All'],
      });
      expect(messages).toHaveLength(1);
      expect(messages[0].messageId).toBe('msg-1');
      expect(messages[0].receiptHandle).toBe('receipt-1');
      expect(messages[0].body.paymentId).toBe('payment-123');
    });

    it('should return empty array when no messages', async () => {
      mockSend.mockResolvedValue({
        Messages: undefined,
      });

      const messages = await sqsService.receiveMessages();

      expect(messages).toEqual([]);
    });

    it('should handle errors when receiving messages', async () => {
      const error = new Error('Receive error');
      mockSend.mockRejectedValue(error);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(sqsService.receiveMessages()).rejects.toThrow('Receive error');
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('deleteMessage', () => {
    it('should delete message from queue', async () => {
      const receiptHandle = 'receipt-123';
      mockSend.mockResolvedValue({});

      await sqsService.deleteMessage(receiptHandle);

      expect(DeleteMessageCommand).toHaveBeenCalledWith({
        QueueUrl: 'http://localhost:4566/000000000000/payment-notifications-queue',
        ReceiptHandle: receiptHandle,
      });
      expect(mockSend).toHaveBeenCalled();
    });

    it('should handle errors when deleting message', async () => {
      const error = new Error('Delete error');
      mockSend.mockRejectedValue(error);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(sqsService.deleteMessage('receipt-123')).rejects.toThrow('Delete error');
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});

