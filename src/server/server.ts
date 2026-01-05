import 'reflect-metadata';
// Load environment variables
import dotenv from 'dotenv';
import path from 'path';

// Load .env.local first, then .env as fallback
const envLocalPath = path.resolve(process.cwd(), '.env.local');
const envPath = path.resolve(process.cwd(), '.env');

dotenv.config({ path: envLocalPath });
dotenv.config({ path: envPath, override: false }); // Don't override .env.local values

import express, { Express } from 'express';
import http from 'http';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { getServerConfig } from './config/server.config';
import routes from './routes';
import { ErrorHandlerMiddleware } from './middleware/error-handler.middleware';
import { NotFoundMiddleware } from './middleware/not-found.middleware';
import { RequestLoggerMiddleware } from './middleware/request-logger.middleware';
import { apiRateLimiter } from './middleware/rate-limit.middleware';
import { WebSocketServer } from './websocket/websocket.server';
import { container } from 'tsyringe';
import { PaymentNotificationWorker } from '../core/application/workers/payment-notification.worker';
import { OrderNotificationWorker } from '../core/application/workers/order-notification.worker';
import '../core/infrastructure/config/dependency-injection';

class LocalServer {
  private app: Express;
  private httpServer: http.Server;
  private config: ReturnType<typeof getServerConfig>;
  private webSocketServer: WebSocketServer | null = null;
  private paymentNotificationWorker: PaymentNotificationWorker | null = null;
  private orderNotificationWorker: OrderNotificationWorker | null = null;

  constructor() {
    this.app = express();
    this.httpServer = http.createServer(this.app);
    this.config = getServerConfig();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
    this.setupWebSocket();
    this.setupWorkers();
  }

  private setupMiddleware(): void {
    // CORS
    this.app.use(
      cors({
        origin: this.config.cors.origin,
        credentials: this.config.cors.credentials,
      })
    );

    // Cookie parser - must be before body parsing
    this.app.use(cookieParser());

    // Body parsing
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Global rate limiting for API endpoints (100 requests per minute)
    // Note: Auth endpoints have stricter limits applied in their routes
    this.app.use('/api', apiRateLimiter);

    // Request logging
    if (this.config.environment === 'development') {
      this.app.use(RequestLoggerMiddleware.handle);
    }
  }

  private setupRoutes(): void {
    // API routes
    this.app.use('/', routes);

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        message: 'Restify API - Local Development Server',
        version: process.env.APP_VERSION || '1.0.0',
        environment: this.config.environment,
        endpoints: {
          health: '/health',
          api: '/api',
        },
      });
    });
  }

  private setupErrorHandling(): void {
    // 404 handler
    this.app.use(NotFoundMiddleware.handle);

    // Error handler
    this.app.use(ErrorHandlerMiddleware.handle);
  }

  private setupWebSocket(): void {
    // Initialize WebSocket server
    this.webSocketServer = new WebSocketServer(this.httpServer);
  }

  private setupWorkers(): void {
    // Start payment notification worker to process SQS queue
    // Uses Long Polling to minimize AWS API calls and costs
    try {
      this.paymentNotificationWorker = container.resolve(PaymentNotificationWorker);
      this.paymentNotificationWorker.start(); // Uses Long Polling (cost-optimized)
      console.log('[Server] Payment notification worker started (Long Polling enabled)');
    } catch (error) {
      console.error('[Server] Error starting payment notification worker:', error);
      // Don't fail server startup if worker fails
    }

    // Start order notification worker to process SQS queue
    // Uses Long Polling to minimize AWS API calls and costs
    try {
      this.orderNotificationWorker = container.resolve(OrderNotificationWorker);
      this.orderNotificationWorker.start(); // Uses Long Polling (cost-optimized)
      console.log('[Server] Order notification worker started (Long Polling enabled)');
    } catch (error) {
      console.error('[Server] Error starting order notification worker:', error);
      // Don't fail server startup if worker fails
    }
  }

  public start(): void {
    const port = this.config.port;
    const host = this.config.host;

    this.httpServer.listen(port, host, () => {
      console.log(`
╔══════════════════════════════════════════════════════════╗
║         Restify API - Local Development Server         ║
╠══════════════════════════════════════════════════════════╣
║  Environment: ${this.config.environment.padEnd(43)} ║
║  Server:      http://${host}:${port.toString().padEnd(36)} ║
║  Health:      http://${host}:${port}/health${' '.padEnd(27)} ║
║  API:         http://${host}:${port}/api${' '.padEnd(30)} ║
║  WebSocket:   ws://${host}:${port}/socket.io${' '.padEnd(20)} ║
╚══════════════════════════════════════════════════════════╝
      `);
    });
  }

  public getApp(): Express {
    return this.app;
  }

  public getHttpServer(): http.Server {
    return this.httpServer;
  }
}

// Start server if this file is executed directly
if (require.main === module) {
  const server = new LocalServer();
  server.start();
}

export default LocalServer;

