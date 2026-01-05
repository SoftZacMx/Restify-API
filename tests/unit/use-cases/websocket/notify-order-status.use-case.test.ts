import { NotifyOrderStatusUseCase, OrderNotificationType } from '../../../../src/core/application/use-cases/websocket/notify-order-status.use-case';
import { IWebSocketConnectionManager } from '../../../../src/core/domain/interfaces/websocket-connection.interface';
import { WebSocketEventType } from '../../../../src/core/domain/interfaces/websocket-connection.interface';

describe('NotifyOrderStatusUseCase', () => {
  let notifyOrderStatusUseCase: NotifyOrderStatusUseCase;
  let mockConnectionManager: jest.Mocked<IWebSocketConnectionManager>;

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

    notifyOrderStatusUseCase = new NotifyOrderStatusUseCase(mockConnectionManager);
  });

  describe('execute', () => {
    it('should notify order created successfully to staff roles', async () => {
      mockConnectionManager.sendToStaffRoles.mockReturnValue(2); // 2 staff connections notified

      const result = await notifyOrderStatusUseCase.execute({
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

      expect(result.notified).toBe(true);
      expect(result.notifiedCount).toBe(2);
      expect(mockConnectionManager.sendToStaffRoles).toHaveBeenCalledWith(
        expect.objectContaining({
          type: WebSocketEventType.ORDER_CREATED,
          data: expect.objectContaining({
            orderId: 'order-123',
            status: 'created',
            message: 'Order created successfully',
            order: expect.objectContaining({
              id: 'order-123',
              status: false,
              total: 100.0,
            }),
          }),
        })
      );
    });

    it('should notify order updated successfully to staff roles', async () => {
      mockConnectionManager.sendToStaffRoles.mockReturnValue(1); // 1 staff connection notified

      const result = await notifyOrderStatusUseCase.execute({
        orderId: 'order-123',
        notificationType: OrderNotificationType.UPDATED,
        orderData: {
          id: 'order-123',
          status: true,
          total: 120.0,
          delivered: false,
        },
      });

      expect(result.notified).toBe(true);
      expect(result.notifiedCount).toBe(1);
      expect(mockConnectionManager.sendToStaffRoles).toHaveBeenCalledWith(
        expect.objectContaining({
          type: WebSocketEventType.ORDER_UPDATED,
          data: expect.objectContaining({
            orderId: 'order-123',
            status: 'updated',
            message: 'Order updated successfully',
          }),
        })
      );
    });

    it('should notify order delivered successfully to staff roles', async () => {
      mockConnectionManager.sendToStaffRoles.mockReturnValue(1);

      const result = await notifyOrderStatusUseCase.execute({
        orderId: 'order-123',
        notificationType: OrderNotificationType.DELIVERED,
        orderData: {
          id: 'order-123',
          delivered: true,
        },
      });

      expect(result.notified).toBe(true);
      expect(result.notifiedCount).toBe(1);
      expect(mockConnectionManager.sendToStaffRoles).toHaveBeenCalledWith(
        expect.objectContaining({
          type: WebSocketEventType.ORDER_DELIVERED,
          data: expect.objectContaining({
            orderId: 'order-123',
            status: 'delivered',
            message: 'Order delivered successfully',
          }),
        })
      );
    });

    it('should return notified: false if no staff connections found', async () => {
      mockConnectionManager.sendToStaffRoles.mockReturnValue(0); // No staff connections

      const result = await notifyOrderStatusUseCase.execute({
        orderId: 'order-123',
        notificationType: OrderNotificationType.CREATED,
      });

      expect(result.notified).toBe(false);
      expect(result.notifiedCount).toBe(0);
      expect(mockConnectionManager.sendToStaffRoles).toHaveBeenCalled();
    });

    it('should notify order canceled successfully to staff roles', async () => {
      mockConnectionManager.sendToStaffRoles.mockReturnValue(2);

      const result = await notifyOrderStatusUseCase.execute({
        orderId: 'order-123',
        notificationType: OrderNotificationType.CANCELED,
        orderData: {
          id: 'order-123',
          status: false,
          total: 100.0,
          delivered: false,
        },
      });

      expect(result.notified).toBe(true);
      expect(result.notifiedCount).toBe(2);
      expect(mockConnectionManager.sendToStaffRoles).toHaveBeenCalledWith(
        expect.objectContaining({
          type: WebSocketEventType.ORDER_CANCELED,
          data: expect.objectContaining({
            orderId: 'order-123',
            status: 'canceled',
            message: 'Order canceled successfully',
          }),
        })
      );
    });

    it('should handle invalid notification type gracefully', async () => {
      mockConnectionManager.sendToStaffRoles.mockReturnValue(0);

      // Using 'as any' to test invalid type handling
      const result = await notifyOrderStatusUseCase.execute({
        orderId: 'order-123',
        notificationType: 'invalid' as any,
      });

      expect(result.notified).toBe(false);
      expect(result.notifiedCount).toBe(0);
      expect(mockConnectionManager.sendToStaffRoles).not.toHaveBeenCalled();
    });

    it('should work without orderData', async () => {
      mockConnectionManager.sendToStaffRoles.mockReturnValue(1);

      const result = await notifyOrderStatusUseCase.execute({
        orderId: 'order-123',
        notificationType: OrderNotificationType.UPDATED,
      });

      expect(result.notified).toBe(true);
      expect(result.notifiedCount).toBe(1);
      expect(mockConnectionManager.sendToStaffRoles).toHaveBeenCalledWith(
        expect.objectContaining({
          type: WebSocketEventType.ORDER_UPDATED,
          data: expect.objectContaining({
            orderId: 'order-123',
            order: undefined,
          }),
        })
      );
    });
  });
});

