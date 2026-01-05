import { injectable } from 'tsyringe';
import { Socket } from 'socket.io';
import { UserRole } from '@prisma/client';
import {
  IWebSocketConnectionManager,
  WebSocketConnection,
  WebSocketMessage,
} from '../../domain/interfaces/websocket-connection.interface';

/**
 * Manages WebSocket connections
 * Maps connectionId (from PaymentSession) to Socket instances
 */
@injectable()
export class WebSocketConnectionManager implements IWebSocketConnectionManager {
  private connections: Map<string, Socket>; // connectionId -> Socket
  private socketToConnection: Map<string, WebSocketConnection>; // socketId -> Connection metadata

  constructor() {
    this.connections = new Map();
    this.socketToConnection = new Map();
  }

  registerConnection(
    socket: Socket,
    connectionId: string,
    metadata?: { userId?: string; userRole?: UserRole; paymentId?: string }
  ): void {
    // Store connection
    this.connections.set(connectionId, socket);

    // Store metadata
    const connection: WebSocketConnection = {
      socketId: socket.id,
      connectionId,
      userId: metadata?.userId,
      userRole: metadata?.userRole,
      paymentId: metadata?.paymentId,
      connectedAt: new Date(),
    };
    this.socketToConnection.set(socket.id, connection);

    // Handle socket disconnect
    socket.on('disconnect', () => {
      this.removeConnection(socket.id);
    });
  }

  removeConnection(socketId: string): void {
    const connection = this.socketToConnection.get(socketId);
    if (connection) {
      this.connections.delete(connection.connectionId);
      this.socketToConnection.delete(socketId);
    }
  }

  getConnectionByConnectionId(connectionId: string): Socket | null {
    return this.connections.get(connectionId) || null;
  }

  getConnectionBySocketId(socketId: string): WebSocketConnection | null {
    return this.socketToConnection.get(socketId) || null;
  }

  sendToConnection(connectionId: string, message: WebSocketMessage): boolean {
    const socket = this.connections.get(connectionId);
    if (!socket || !socket.connected) {
      return false;
    }

    try {
      socket.emit(message.type, message);
      return true;
    } catch (error) {
      console.error(`Error sending message to connection ${connectionId}:`, error);
      return false;
    }
  }

  getAllConnections(): WebSocketConnection[] {
    return Array.from(this.socketToConnection.values());
  }

  /**
   * Get connection count
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Check if a connection exists
   */
  hasConnection(connectionId: string): boolean {
    return this.connections.has(connectionId);
  }

  /**
   * Send message to all connections of a specific user
   * Returns the number of connections that received the message
   */
  sendToUser(userId: string, message: WebSocketMessage): number {
    const userConnections = this.getAllConnections().filter(
      (conn) => conn.userId === userId
    );

    let sentCount = 0;
    for (const connection of userConnections) {
      if (this.sendToConnection(connection.connectionId, message)) {
        sentCount++;
      }
    }

    return sentCount;
  }

  /**
   * Send message to all connections of staff users (ADMIN, MANAGER, WAITER, CHEF)
   * Excludes client users (users without these roles)
   * Returns the number of connections that received the message
   */
  sendToStaffRoles(message: WebSocketMessage): number {
    const staffRoles: UserRole[] = [
      UserRole.ADMIN,
      UserRole.MANAGER,
      UserRole.WAITER,
      UserRole.CHEF,
    ];

    const staffConnections = this.getAllConnections().filter(
      (conn) => conn.userRole && staffRoles.includes(conn.userRole)
    );

    let sentCount = 0;
    for (const connection of staffConnections) {
      if (this.sendToConnection(connection.connectionId, message)) {
        sentCount++;
      }
    }

    return sentCount;
  }
}

