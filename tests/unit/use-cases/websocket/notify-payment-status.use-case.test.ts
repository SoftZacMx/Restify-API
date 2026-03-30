import { NotifyPaymentStatusUseCase } from '../../../../src/core/application/use-cases/websocket/notify-payment-status.use-case';
import { IWebSocketConnectionManager } from '../../../../src/core/domain/interfaces/websocket-connection.interface';
import { IPaymentSessionRepository } from '../../../../src/core/domain/interfaces/payment-session-repository.interface';
import { PaymentSession } from '../../../../src/core/domain/entities/payment-session.entity';
import { PaymentStatus } from '@prisma/client';
import { WebSocketEventType } from '../../../../src/core/domain/interfaces/websocket-connection.interface';

describe('NotifyPaymentStatusUseCase', () => {
  let notifyPaymentStatusUseCase: NotifyPaymentStatusUseCase;
  let mockConnectionManager: jest.Mocked<IWebSocketConnectionManager>;
  let mockPaymentSessionRepository: jest.Mocked<IPaymentSessionRepository>;

  beforeEach(() => {
    mockConnectionManager = {
      registerConnection: jest.fn(),
      removeConnection: jest.fn(),
      getConnectionByConnectionId: jest.fn(),
      getConnectionBySocketId: jest.fn(),
      sendToConnection: jest.fn(),
      getAllConnections: jest.fn(),
      sendToUser: jest.fn(),
      sendToStaffRoles: jest.fn(),
    };

    mockPaymentSessionRepository = {
      findById: jest.fn(),
      findByPaymentId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteByPaymentId: jest.fn(),
    };

    notifyPaymentStatusUseCase = new NotifyPaymentStatusUseCase(
      mockConnectionManager,
      mockPaymentSessionRepository
    );
  });

  describe('execute', () => {
    it('should notify payment confirmed successfully', async () => {
      const session = new PaymentSession(
        'session-123',
        'payment-123',
        'client-secret',
        'conn-123',
        new Date(),
        new Date()
      );

      mockPaymentSessionRepository.findByPaymentId.mockResolvedValue(session);
      mockConnectionManager.sendToConnection.mockReturnValue(true);

      const result = await notifyPaymentStatusUseCase.execute({
        paymentId: 'payment-123',
        status: PaymentStatus.SUCCEEDED,
        orderId: 'order-123',
      });

      expect(result.notified).toBe(true);
      expect(mockPaymentSessionRepository.findByPaymentId).toHaveBeenCalledWith('payment-123');
      expect(mockConnectionManager.sendToConnection).toHaveBeenCalledWith(
        'conn-123',
        expect.objectContaining({
          type: WebSocketEventType.PAYMENT_CONFIRMED,
          data: expect.objectContaining({
            paymentId: 'payment-123',
            orderId: 'order-123',
            status: 'succeeded',
          }),
        })
      );
    });

    it('should notify payment failed', async () => {
      const session = new PaymentSession(
        'session-123',
        'payment-123',
        'client-secret',
        'conn-123',
        new Date(),
        new Date()
      );

      mockPaymentSessionRepository.findByPaymentId.mockResolvedValue(session);
      mockConnectionManager.sendToConnection.mockReturnValue(true);

      const result = await notifyPaymentStatusUseCase.execute({
        paymentId: 'payment-123',
        status: PaymentStatus.FAILED,
        error: 'Payment failed',
      });

      expect(result.notified).toBe(true);
      expect(mockConnectionManager.sendToConnection).toHaveBeenCalledWith(
        'conn-123',
        expect.objectContaining({
          type: WebSocketEventType.PAYMENT_FAILED,
          data: expect.objectContaining({
            status: 'failed',
            error: 'Payment failed',
          }),
        })
      );
    });

    it('should notify payment pending', async () => {
      const session = new PaymentSession(
        'session-123',
        'payment-123',
        'client-secret',
        'conn-123',
        new Date(),
        new Date()
      );

      mockPaymentSessionRepository.findByPaymentId.mockResolvedValue(session);
      mockConnectionManager.sendToConnection.mockReturnValue(true);

      const result = await notifyPaymentStatusUseCase.execute({
        paymentId: 'payment-123',
        status: PaymentStatus.PENDING,
      });

      expect(result.notified).toBe(true);
      expect(mockConnectionManager.sendToConnection).toHaveBeenCalledWith(
        'conn-123',
        expect.objectContaining({
          type: WebSocketEventType.PAYMENT_PENDING,
        })
      );
    });

    it('should return notified: false if payment session not found', async () => {
      mockPaymentSessionRepository.findByPaymentId.mockResolvedValue(null);

      const result = await notifyPaymentStatusUseCase.execute({
        paymentId: 'payment-123',
        status: PaymentStatus.SUCCEEDED,
      });

      expect(result.notified).toBe(false);
      expect(mockConnectionManager.sendToConnection).not.toHaveBeenCalled();
    });

    it('should return notified: false if connectionId is null', async () => {
      const session = new PaymentSession(
        'session-123',
        'payment-123',
        'client-secret',
        null, // No connectionId
        new Date(),
        new Date()
      );

      mockPaymentSessionRepository.findByPaymentId.mockResolvedValue(session);

      const result = await notifyPaymentStatusUseCase.execute({
        paymentId: 'payment-123',
        status: PaymentStatus.SUCCEEDED,
      });

      expect(result.notified).toBe(false);
      expect(mockConnectionManager.sendToConnection).not.toHaveBeenCalled();
    });

    it('should return notified: false if sendToConnection returns false', async () => {
      const session = new PaymentSession(
        'session-123',
        'payment-123',
        'client-secret',
        'conn-123',
        new Date(),
        new Date()
      );

      mockPaymentSessionRepository.findByPaymentId.mockResolvedValue(session);
      mockConnectionManager.sendToConnection.mockReturnValue(false); // Client not connected

      const result = await notifyPaymentStatusUseCase.execute({
        paymentId: 'payment-123',
        status: PaymentStatus.SUCCEEDED,
      });

      expect(result.notified).toBe(false);
    });

    it('should not notify for unsupported statuses', async () => {
      const session = new PaymentSession(
        'session-123',
        'payment-123',
        'client-secret',
        'conn-123',
        new Date(),
        new Date()
      );

      mockPaymentSessionRepository.findByPaymentId.mockResolvedValue(session);

      const result = await notifyPaymentStatusUseCase.execute({
        paymentId: 'payment-123',
        status: PaymentStatus.REFUNDED, // Unsupported status
      });

      expect(result.notified).toBe(false);
      expect(mockConnectionManager.sendToConnection).not.toHaveBeenCalled();
    });
  });
});

