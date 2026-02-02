import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { container } from 'tsyringe';
import { IWebSocketConnectionManager } from '../../core/domain/interfaces/websocket-connection.interface';
import { WebSocketConnectionManager } from '../../core/infrastructure/websocket/websocket-connection-manager';
import { IPaymentSessionRepository } from '../../core/domain/interfaces/payment-session-repository.interface';
import { IUserRepository } from '../../core/domain/interfaces/user-repository.interface';
import { WebSocketEventType, WebSocketMessage } from '../../core/domain/interfaces/websocket-connection.interface';
import { JwtUtil, JwtPayload } from '../../shared/utils/jwt.util';
import { AppError } from '../../shared/errors';
import { stripEnvQuotes } from '../config/server.config';

export class WebSocketServer {
  private io: SocketIOServer;
  private connectionManager: IWebSocketConnectionManager;

  constructor(httpServer: HttpServer) {
    const corsOrigin = process.env.CORS_ORIGIN ? stripEnvQuotes(process.env.CORS_ORIGIN) : '*';
    // Initialize Socket.IO server
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: corsOrigin,
        credentials: true,
        methods: ['GET', 'POST'],
      },
      path: '/socket.io',
    });

    // Get connection manager from DI container
    this.connectionManager = container.resolve<IWebSocketConnectionManager>(
      'IWebSocketConnectionManager'
    );

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.io.on('connection', async (socket: Socket) => {
      // Handle connection registration
      socket.on('register_connection', async (data: { connectionId: string; paymentId?: string; userId?: string; token?: string }) => {
        try {
          const { connectionId, paymentId, userId, token } = data;

          if (!connectionId) {
            socket.emit(WebSocketEventType.ERROR, {
              type: WebSocketEventType.ERROR,
              data: { message: 'connectionId is required' },
              timestamp: new Date(),
            });
            return;
          }

          // Extract token from handshake or data
          let authToken: string | undefined = token;
          if (!authToken) {
            // Try to get from handshake auth
            authToken = (socket.handshake.auth as any)?.token;
          }
          if (!authToken) {
            // Try to get from Authorization header
            const authHeader = socket.handshake.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
              authToken = authHeader.substring(7);
            }
          }

          // Validate JWT token if userId is provided (required for staff notifications)
          let tokenPayload: JwtPayload | null = null;
          if (userId) {
            if (!authToken) {
              socket.emit(WebSocketEventType.ERROR, {
                type: WebSocketEventType.ERROR,
                data: { message: 'Authentication token is required when userId is provided' },
                timestamp: new Date(),
              });
              return;
            }

            try {
              tokenPayload = JwtUtil.verifyToken(authToken);
            } catch (error) {
              socket.emit(WebSocketEventType.ERROR, {
                type: WebSocketEventType.ERROR,
                data: { message: 'Invalid or expired authentication token' },
                timestamp: new Date(),
              });
              return;
            }

            // Verify that userId from token matches userId in request
            if (tokenPayload.userId && tokenPayload.userId !== userId) {
              socket.emit(WebSocketEventType.ERROR, {
                type: WebSocketEventType.ERROR,
                data: { message: 'UserId mismatch: token userId does not match provided userId' },
                timestamp: new Date(),
              });
              return;
            }
          }

          // Verify connectionId exists in PaymentSession (optional validation)
          const paymentSessionRepository = container.resolve<IPaymentSessionRepository>(
            'IPaymentSessionRepository'
          );

          // Try to find payment session to validate connectionId
          // Note: This is optional - we allow connections even if session doesn't exist yet
          // (e.g., client connects before payment session is created)
          let isValidConnection = true;
          if (paymentId) {
            const session = await paymentSessionRepository.findByPaymentId(paymentId);
            if (session && session.connectionId !== connectionId) {
              isValidConnection = false;
            }
          }

          if (!isValidConnection) {
            socket.emit(WebSocketEventType.ERROR, {
              type: WebSocketEventType.ERROR,
              data: { message: 'Invalid connectionId for this payment' },
              timestamp: new Date(),
            });
            return;
          }

          // Get user role and validate user exists and is active
          let userRole: any = undefined;
          if (userId) {
            try {
              const userRepository = container.resolve<IUserRepository>('IUserRepository');
              const user = await userRepository.findById(userId);
              
              if (!user) {
                socket.emit(WebSocketEventType.ERROR, {
                  type: WebSocketEventType.ERROR,
                  data: { message: 'User not found' },
                  timestamp: new Date(),
                });
                return;
              }

              // Verify user is active
              if (!user.status) {
                socket.emit(WebSocketEventType.ERROR, {
                  type: WebSocketEventType.ERROR,
                  data: { message: 'User account is inactive' },
                  timestamp: new Date(),
                });
                return;
              }

              userRole = user.rol;

              // Verify role matches token if token has role
              if (tokenPayload?.rol && tokenPayload.rol !== user.rol) {
                socket.emit(WebSocketEventType.ERROR, {
                  type: WebSocketEventType.ERROR,
                  data: { message: 'User role mismatch: token role does not match user role' },
                  timestamp: new Date(),
                });
                return;
              }
            } catch (error) {
              console.error('[WebSocket] Error fetching user:', error);
              socket.emit(WebSocketEventType.ERROR, {
                type: WebSocketEventType.ERROR,
                data: { message: 'Failed to validate user' },
                timestamp: new Date(),
              });
              return;
            }
          }

          // Register connection with user role
          this.connectionManager.registerConnection(socket, connectionId, {
            userId,
            userRole,
            paymentId,
          });

          // Update PaymentSession with connectionId if paymentId is provided
          if (paymentId) {
            try {
              const session = await paymentSessionRepository.findByPaymentId(paymentId);
              if (session && !session.connectionId) {
                await paymentSessionRepository.update(session.id, {
                  connectionId,
                });
              }
            } catch (error) {
              console.error('Error updating PaymentSession with connectionId:', error);
              // Don't fail connection registration if update fails
            }
          }

          // Send acknowledgment
          const ackMessage: WebSocketMessage = {
            type: WebSocketEventType.CONNECTION_ACK,
            data: {
              connectionId,
              message: 'Connection registered successfully',
            },
            timestamp: new Date(),
            connectionId,
          };

          socket.emit(WebSocketEventType.CONNECTION_ACK, ackMessage);
        } catch (error) {
          console.error('[WebSocket] Error registering connection:', error);
          socket.emit(WebSocketEventType.ERROR, {
            type: WebSocketEventType.ERROR,
            data: {
              message: 'Failed to register connection',
              error: error instanceof Error ? error.message : 'Unknown error',
            },
            timestamp: new Date(),
          });
        }
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        this.connectionManager.removeConnection(socket.id);
      });

      // Handle ping/pong for keep-alive
      socket.on('ping', () => {
        socket.emit('pong', { timestamp: new Date() });
      });
    });
  }

  /**
   * Get the Socket.IO server instance
   */
  public getIO(): SocketIOServer {
    return this.io;
  }

  /**
   * Get connection manager
   */
  public getConnectionManager(): IWebSocketConnectionManager {
    return this.connectionManager;
  }

  /**
   * Close WebSocket server
   */
  public close(): void {
    this.io.close();
  }
}

