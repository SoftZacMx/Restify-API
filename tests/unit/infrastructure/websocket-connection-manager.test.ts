import { WebSocketConnectionManager } from '../../../src/core/infrastructure/websocket/websocket-connection-manager';
import { WebSocketConnection, WebSocketEventType, WebSocketMessage } from '../../../src/core/domain/interfaces/websocket-connection.interface';
import { Socket } from 'socket.io';
import { UserRole } from '@prisma/client';

describe('WebSocketConnectionManager', () => {
  let connectionManager: WebSocketConnectionManager;
  let mockSocket: jest.Mocked<Partial<Socket>>;

  beforeEach(() => {
    connectionManager = new WebSocketConnectionManager();
    
    mockSocket = {
      id: 'socket-123',
      connected: true,
      emit: jest.fn(),
      on: jest.fn(),
    } as any;
  });

  describe('registerConnection', () => {
    it('should register a new connection', () => {
      const connectionId = 'conn-123';
      const metadata = { userId: 'user-123', paymentId: 'payment-123' };

      connectionManager.registerConnection(mockSocket as Socket, connectionId, metadata);

      const connection = connectionManager.getConnectionBySocketId('socket-123');
      expect(connection).toBeDefined();
      expect(connection?.connectionId).toBe(connectionId);
      expect(connection?.userId).toBe('user-123');
      expect(connection?.paymentId).toBe('payment-123');
    });

    it('should set up disconnect handler when registering', () => {
      const connectionId = 'conn-123';
      connectionManager.registerConnection(mockSocket as Socket, connectionId);

      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
    });
  });

  describe('removeConnection', () => {
    it('should remove a connection by socketId', () => {
      const connectionId = 'conn-123';
      connectionManager.registerConnection(mockSocket as Socket, connectionId);

      connectionManager.removeConnection('socket-123');

      const connection = connectionManager.getConnectionBySocketId('socket-123');
      expect(connection).toBeNull();
      
      const socket = connectionManager.getConnectionByConnectionId(connectionId);
      expect(socket).toBeNull();
    });

    it('should handle removing non-existent connection gracefully', () => {
      expect(() => {
        connectionManager.removeConnection('non-existent');
      }).not.toThrow();
    });
  });

  describe('getConnectionByConnectionId', () => {
    it('should return socket for existing connectionId', () => {
      const connectionId = 'conn-123';
      connectionManager.registerConnection(mockSocket as Socket, connectionId);

      const socket = connectionManager.getConnectionByConnectionId(connectionId);
      expect(socket).toBe(mockSocket);
    });

    it('should return null for non-existent connectionId', () => {
      const socket = connectionManager.getConnectionByConnectionId('non-existent');
      expect(socket).toBeNull();
    });
  });

  describe('getConnectionBySocketId', () => {
    it('should return connection metadata for existing socketId', () => {
      const connectionId = 'conn-123';
      const metadata = { userId: 'user-123' };
      connectionManager.registerConnection(mockSocket as Socket, connectionId, metadata);

      const connection = connectionManager.getConnectionBySocketId('socket-123');
      expect(connection).toBeDefined();
      expect(connection?.connectionId).toBe(connectionId);
      expect(connection?.userId).toBe('user-123');
    });

    it('should return null for non-existent socketId', () => {
      const connection = connectionManager.getConnectionBySocketId('non-existent');
      expect(connection).toBeNull();
    });
  });

  describe('sendToConnection', () => {
    it('should send message to connected socket', () => {
      const connectionId = 'conn-123';
      connectionManager.registerConnection(mockSocket as Socket, connectionId);

      const message: WebSocketMessage = {
        type: WebSocketEventType.PAYMENT_CONFIRMED,
        data: { paymentId: 'payment-123' },
        timestamp: new Date(),
        connectionId,
      };

      const result = connectionManager.sendToConnection(connectionId, message);

      expect(result).toBe(true);
      expect(mockSocket.emit).toHaveBeenCalledWith(WebSocketEventType.PAYMENT_CONFIRMED, message);
    });

    it('should return false if connection does not exist', () => {
      const message: WebSocketMessage = {
        type: WebSocketEventType.PAYMENT_CONFIRMED,
        data: {},
        timestamp: new Date(),
      };

      const result = connectionManager.sendToConnection('non-existent', message);
      expect(result).toBe(false);
    });

    it('should return false if socket is not connected', () => {
      const connectionId = 'conn-123';
      const disconnectedSocket = { ...mockSocket, connected: false } as any;
      connectionManager.registerConnection(disconnectedSocket as Socket, connectionId);

      const message: WebSocketMessage = {
        type: WebSocketEventType.PAYMENT_CONFIRMED,
        data: {},
        timestamp: new Date(),
      };

      const result = connectionManager.sendToConnection(connectionId, message);
      expect(result).toBe(false);
    });

    it('should handle emit errors gracefully', () => {
      const connectionId = 'conn-123';
      const errorSocket = {
        ...mockSocket,
        emit: jest.fn().mockImplementation(() => {
          throw new Error('Emit failed');
        }),
      } as any;
      connectionManager.registerConnection(errorSocket as Socket, connectionId);

      const message: WebSocketMessage = {
        type: WebSocketEventType.PAYMENT_CONFIRMED,
        data: {},
        timestamp: new Date(),
      };

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const result = connectionManager.sendToConnection(connectionId, message);
      
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('getAllConnections', () => {
    it('should return all registered connections', () => {
      const socket1 = { id: 'socket-1', connected: true, emit: jest.fn(), on: jest.fn() } as any;
      const socket2 = { id: 'socket-2', connected: true, emit: jest.fn(), on: jest.fn() } as any;

      connectionManager.registerConnection(socket1, 'conn-1');
      connectionManager.registerConnection(socket2, 'conn-2');

      const connections = connectionManager.getAllConnections();
      expect(connections).toHaveLength(2);
      expect(connections.map(c => c.connectionId)).toContain('conn-1');
      expect(connections.map(c => c.connectionId)).toContain('conn-2');
    });

    it('should return empty array when no connections', () => {
      const connections = connectionManager.getAllConnections();
      expect(connections).toEqual([]);
    });
  });

  describe('getConnectionCount', () => {
    it('should return correct connection count', () => {
      expect(connectionManager.getConnectionCount()).toBe(0);

      connectionManager.registerConnection(mockSocket as Socket, 'conn-1');
      expect(connectionManager.getConnectionCount()).toBe(1);

      const socket2 = { id: 'socket-2', connected: true, emit: jest.fn(), on: jest.fn() } as any;
      connectionManager.registerConnection(socket2, 'conn-2');
      expect(connectionManager.getConnectionCount()).toBe(2);
    });
  });

  describe('hasConnection', () => {
    it('should return true for existing connection', () => {
      connectionManager.registerConnection(mockSocket as Socket, 'conn-123');
      expect(connectionManager.hasConnection('conn-123')).toBe(true);
    });

    it('should return false for non-existent connection', () => {
      expect(connectionManager.hasConnection('non-existent')).toBe(false);
    });
  });

  describe('sendToUser', () => {
    it('should send message to all connections of a user', () => {
      const socket1 = { id: 'socket-1', connected: true, emit: jest.fn(), on: jest.fn() } as any;
      const socket2 = { id: 'socket-2', connected: true, emit: jest.fn(), on: jest.fn() } as any;
      const socket3 = { id: 'socket-3', connected: true, emit: jest.fn(), on: jest.fn() } as any;

      // Register 2 connections for user-123 and 1 for user-456
      connectionManager.registerConnection(socket1, 'conn-1', { userId: 'user-123' });
      connectionManager.registerConnection(socket2, 'conn-2', { userId: 'user-123' });
      connectionManager.registerConnection(socket3, 'conn-3', { userId: 'user-456' });

      const message: WebSocketMessage = {
        type: WebSocketEventType.ORDER_CREATED,
        data: { orderId: 'order-123' },
        timestamp: new Date(),
      };

      const result = connectionManager.sendToUser('user-123', message);

      expect(result).toBe(2); // Should notify 2 connections
      expect(socket1.emit).toHaveBeenCalledWith(WebSocketEventType.ORDER_CREATED, message);
      expect(socket2.emit).toHaveBeenCalledWith(WebSocketEventType.ORDER_CREATED, message);
      expect(socket3.emit).not.toHaveBeenCalled(); // Should not notify user-456
    });

    it('should return 0 if user has no connections', () => {
      const message: WebSocketMessage = {
        type: WebSocketEventType.ORDER_CREATED,
        data: { orderId: 'order-123' },
        timestamp: new Date(),
      };

      const result = connectionManager.sendToUser('user-no-connections', message);
      expect(result).toBe(0);
    });

    it('should only count successfully sent messages', () => {
      const socket1 = { id: 'socket-1', connected: true, emit: jest.fn(), on: jest.fn() } as any;
      const socket2 = { id: 'socket-2', connected: false, emit: jest.fn(), on: jest.fn() } as any; // Disconnected

      connectionManager.registerConnection(socket1, 'conn-1', { userId: 'user-123' });
      connectionManager.registerConnection(socket2, 'conn-2', { userId: 'user-123' });

      const message: WebSocketMessage = {
        type: WebSocketEventType.ORDER_UPDATED,
        data: { orderId: 'order-123' },
        timestamp: new Date(),
      };

      const result = connectionManager.sendToUser('user-123', message);

      expect(result).toBe(1); // Only socket1 should receive the message
      expect(socket1.emit).toHaveBeenCalled();
      expect(socket2.emit).not.toHaveBeenCalled();
    });
  });

  describe('sendToStaffRoles', () => {
    it('should send message only to staff role connections (ADMIN, MANAGER, WAITER, CHEF)', () => {
      const socket1 = { id: 'socket-1', connected: true, emit: jest.fn(), on: jest.fn() } as any;
      const socket2 = { id: 'socket-2', connected: true, emit: jest.fn(), on: jest.fn() } as any;
      const socket3 = { id: 'socket-3', connected: true, emit: jest.fn(), on: jest.fn() } as any;
      const socket4 = { id: 'socket-4', connected: true, emit: jest.fn(), on: jest.fn() } as any;
      const socket5 = { id: 'socket-5', connected: true, emit: jest.fn(), on: jest.fn() } as any;

      // Register connections with different roles
      connectionManager.registerConnection(socket1, 'conn-1', { userId: 'user-1', userRole: UserRole.ADMIN });
      connectionManager.registerConnection(socket2, 'conn-2', { userId: 'user-2', userRole: UserRole.WAITER });
      connectionManager.registerConnection(socket3, 'conn-3', { userId: 'user-3', userRole: UserRole.MANAGER });
      connectionManager.registerConnection(socket4, 'conn-4', { userId: 'user-4', userRole: UserRole.CHEF });
      connectionManager.registerConnection(socket5, 'conn-5', { userId: 'user-5' }); // No role (client)

      const message: WebSocketMessage = {
        type: WebSocketEventType.ORDER_CREATED,
        data: { orderId: 'order-123' },
        timestamp: new Date(),
      };

      const result = connectionManager.sendToStaffRoles(message);

      expect(result).toBe(4); // Should notify 4 staff connections
      expect(socket1.emit).toHaveBeenCalledWith(WebSocketEventType.ORDER_CREATED, message);
      expect(socket2.emit).toHaveBeenCalledWith(WebSocketEventType.ORDER_CREATED, message);
      expect(socket3.emit).toHaveBeenCalledWith(WebSocketEventType.ORDER_CREATED, message);
      expect(socket4.emit).toHaveBeenCalledWith(WebSocketEventType.ORDER_CREATED, message);
      expect(socket5.emit).not.toHaveBeenCalled(); // Should not notify client
    });

    it('should return 0 if no staff connections exist', () => {
      const socket1 = { id: 'socket-1', connected: true, emit: jest.fn(), on: jest.fn() } as any;
      
      // Register connection without staff role
      connectionManager.registerConnection(socket1, 'conn-1', { userId: 'user-1' });

      const message: WebSocketMessage = {
        type: WebSocketEventType.ORDER_CREATED,
        data: { orderId: 'order-123' },
        timestamp: new Date(),
      };

      const result = connectionManager.sendToStaffRoles(message);
      expect(result).toBe(0);
      expect(socket1.emit).not.toHaveBeenCalled();
    });

    it('should only count successfully sent messages to staff', () => {
      const socket1 = { id: 'socket-1', connected: true, emit: jest.fn(), on: jest.fn() } as any;
      const socket2 = { id: 'socket-2', connected: false, emit: jest.fn(), on: jest.fn() } as any; // Disconnected

      connectionManager.registerConnection(socket1, 'conn-1', { userId: 'user-1', userRole: UserRole.WAITER });
      connectionManager.registerConnection(socket2, 'conn-2', { userId: 'user-2', userRole: UserRole.ADMIN });

      const message: WebSocketMessage = {
        type: WebSocketEventType.ORDER_UPDATED,
        data: { orderId: 'order-123' },
        timestamp: new Date(),
      };

      const result = connectionManager.sendToStaffRoles(message);

      expect(result).toBe(1); // Only socket1 should receive the message
      expect(socket1.emit).toHaveBeenCalled();
      expect(socket2.emit).not.toHaveBeenCalled();
    });
  });
});

