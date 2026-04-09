import 'reflect-metadata';
// Load environment variables from .env only
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { validateEnv } from './config/env.config';
validateEnv();

import express, { Express, Request, Response, NextFunction } from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { getServerConfig } from './config/server.config';
import routes from './routes';
import { expressErrorHandler } from '../shared/middleware/error-handler.middleware';
import { NotFoundMiddleware } from './middleware/not-found.middleware';
import { RequestLoggerMiddleware } from './middleware/request-logger.middleware';
import { apiRateLimiter } from './middleware/rate-limit.middleware';
import { WebSocketServer } from './websocket/websocket.server';
import { container } from 'tsyringe';
import { PrismaService } from '../core/infrastructure/config/prisma.config';
import { logger } from '../shared/utils/logger';
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
    // Trust proxy (Railway, etc.) para que express-rate-limit use X-Forwarded-For correctamente.
    this.app.set('trust proxy', 1);

    const { cors: corsConfig } = this.config;

    const corsOptions: cors.CorsOptions = {
      origin: corsConfig.origin,
      credentials: corsConfig.credentials,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    };

    this.app.use(helmet());
    this.app.use(cors(corsOptions));
    // Cookie parser - must be before body parsing
    this.app.use(cookieParser());

    // Raw body para webhook de Stripe (ANTES del JSON parser global)
    this.app.use('/api/subscription/webhooks/stripe', express.raw({ type: 'application/json' }));

    // Body parsing
    this.app.use(express.json({ limit: '1mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '1mb' }));

    // Global rate limiting for API endpoints (100 requests per minute)
    // Note: Auth endpoints have stricter limits applied in their routes
    // Stripe webhooks are excluded — they arrive in bursts and are authenticated via signature
    this.app.use('/api', (req: Request, res: Response, next: NextFunction) => {
      if (req.path === '/subscription/webhooks/stripe') return next();
      apiRateLimiter(req, res, next);
    });

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
//I
  private setupErrorHandling(): void {
    // 404 handler
    this.app.use(NotFoundMiddleware.handle);

    // Error handler
    this.app.use(expressErrorHandler);
  }

  private setupWebSocket(): void {
    // Initialize WebSocket server
    this.webSocketServer = new WebSocketServer(this.httpServer);
  }

  public async start(): Promise<void> {
    const port = this.config.port;
    const host = this.config.host;

    // Escuchar primero para que Railway/proxy reciba respuestas de inmediato (evita 502 en OPTIONS/health).
    this.httpServer.listen(port, host, () => {
      logger.info({ port, host, env: this.config.environment }, 'API escuchando');
    });

    // Comprobar DB en segundo plano; no bloquear el arranque.
    try {
      const prismaService = container.resolve(PrismaService);
      await prismaService.connect();
      const isHealthy = await prismaService.healthCheck();
      if (isHealthy) {
        logger.info('Conectado a la base de datos correctamente. API lista.');
      } else {
        logger.warn('La base de datos no responde correctamente');
      }
    } catch (error) {
      logger.error({ err: error }, 'Error al conectar con la base de datos');
    }

    this.setupGracefulShutdown();
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      logger.info(`${signal} recibido. Cerrando servidor...`);

      // 1. Dejar de aceptar nuevas conexiones y esperar las que están en curso
      this.httpServer.close(() => {
        logger.info('Servidor HTTP cerrado');
      });

      // 2. Cerrar WebSocket
      if (this.webSocketServer) {
        this.webSocketServer.close();
        logger.info('WebSocket cerrado');
      }

      // 3. Cerrar conexión a BD
      try {
        const prismaService = container.resolve(PrismaService);
        await prismaService.disconnect();
        logger.info('Base de datos desconectada');
      } catch (error) {
        logger.error({ err: error }, 'Error al desconectar base de datos');
      }

      process.exit(0);
    };

    // Timeout de seguridad: si no termina en 10s, forzar salida
    const forceShutdown = (signal: string) => {
      shutdown(signal);
      setTimeout(() => {
        logger.error('Shutdown forzado por timeout (10s)');
        process.exit(1);
      }, 10000).unref();
    };

    process.on('SIGTERM', () => forceShutdown('SIGTERM'));
    process.on('SIGINT', () => forceShutdown('SIGINT'));
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
    logger.fatal({ err: error }, 'Error al iniciar el servidor');
    process.exit(1);
  });
}

export default LocalServer;

