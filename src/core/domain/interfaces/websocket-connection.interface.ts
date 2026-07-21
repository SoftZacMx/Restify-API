import { Socket } from 'socket.io';
import { UserRole } from '@prisma/client';

/**
 * WebSocket connection metadata
 */
export interface WebSocketConnection {
  socketId: string;
  connectionId: string; // Custom connection ID (from PaymentSession)
  userId?: string;
  userRole?: UserRole; // User role for filtering staff notifications
  branchId?: string; // Sucursal activa del usuario (del token) para filtrar notificaciones por branch
  organizationId?: string; // Organización del usuario (del token) para aislar notificaciones entre tenants
  paymentId?: string;
  connectedAt: Date;
}

/**
 * WebSocket event types
 */
export enum WebSocketEventType {
  // Connection events
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  CONNECTION_ACK = 'connection_ack',

  // Payment events
  PAYMENT_CONFIRMED = 'payment_confirmed',
  PAYMENT_FAILED = 'payment_failed',
  PAYMENT_PENDING = 'payment_pending',

  // Order events
  ORDER_CREATED = 'order_created',
  ORDER_UPDATED = 'order_updated',
  ORDER_DELIVERED = 'order_delivered',
  ORDER_CANCELED = 'order_canceled',
  ORDER_NEW_ONLINE = 'order_new_online',

  // Error events
  ERROR = 'error',
}

/**
 * WebSocket message structure
 */
export interface WebSocketMessage {
  type: WebSocketEventType;
  data: any;
  timestamp: Date;
  connectionId?: string;
}

/**
 * Interface for WebSocket connection manager
 */
export interface IWebSocketConnectionManager {
  /**
   * Register a new connection
   */
  registerConnection(
    socket: Socket,
    connectionId: string,
    metadata?: { userId?: string; userRole?: UserRole; branchId?: string; organizationId?: string; paymentId?: string }
  ): void;

  /**
   * Remove a connection
   */
  removeConnection(socketId: string): void;

  /**
   * Get connection by connectionId
   */
  getConnectionByConnectionId(connectionId: string): Socket | null;

  /**
   * Get connection by socketId
   */
  getConnectionBySocketId(socketId: string): WebSocketConnection | null;

  /**
   * Send message to a specific connection
   */
  sendToConnection(connectionId: string, message: WebSocketMessage): boolean;

  /**
   * Get all active connections
   */
  getAllConnections(): WebSocketConnection[];

  /**
   * Send message to all connections of a specific user
   */
  sendToUser(userId: string, message: WebSocketMessage): number;

  /**
   * Send message to all connections of staff users (OWNER, ADMIN, MANAGER, WAITER, CHEF)
   * Excludes client users.
   *
   * `scope` acota los destinatarios al tenant correcto:
   *  - `organizationId`: solo staff de esa organización (aísla restaurantes distintos).
   *  - `branchId`: solo staff cuya sucursal activa coincide.
   * Sin `scope` se mantiene el broadcast a todo el staff (comportamiento legacy).
   */
  sendToStaffRoles(
    message: WebSocketMessage,
    scope?: { branchId?: string; organizationId?: string }
  ): number;
}

