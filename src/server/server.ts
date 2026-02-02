import 'reflect-metadata';
// Load environment variables from .env only
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import express, { Express, Request, Response, NextFunction } from 'express';
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
import { PrismaService } from '../core/infrastructure/config/prisma.config';
import '../core/infrastructure/config/dependency-injection';

class LocalServer {
  private app: Express;
  private httpServer: http.Server;
  private config: ReturnType<typeof getServerConfig>;
  private webSocketServer: WebSocketServer | null = null;

  constructor() {
    this.app = express();
    this.httpServer = http.createServer(this.app);
    this.config = getServerConfig();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
    this.setupWebSocket();
  }

  private setupMiddleware(): void {
    // CORS: paquete estándar; refleja el origen de la petición (cualquier origen permitido) y permite credentials.
    this.app.use(
      cors({
        origin: true, // refleja req.headers.origin (cualquier origen)
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
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

  public async start(): Promise<void> {
    const port = this.config.port;
    const host = this.config.host;

    // Escuchar primero para que Railway/proxy reciba respuestas de inmediato (evita 502 en OPTIONS/health).
    this.httpServer.listen(port, host);

    // Comprobar DB en segundo plano; no bloquear el arranque.
    try {
      const prismaService = container.resolve(PrismaService);
      await prismaService.connect();
      const isHealthy = await prismaService.healthCheck();
      if (!isHealthy) {
        console.warn('⚠️  [Server] Advertencia: La base de datos no responde correctamente');
      }
    } catch (error) {
      console.error('❌ [Server] Error al conectar con la base de datos:', error);
      console.error('❌ [Server] El servidor está en marcha pero la base de datos puede no estar disponible');
    }
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
  server.start().catch((error) => {
    console.error('❌ [Server] Error al iniciar el servidor:', error);
    process.exit(1);
  });
}

export default LocalServer;

