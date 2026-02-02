import { Router, Request, Response } from 'express';
import { PrismaService } from '../../core/infrastructure/config/prisma.config';
import { container } from 'tsyringe';

const router = Router();

/**
 * GET /api/health
 * Health check endpoint
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const prismaService = container.resolve(PrismaService);
    const dbHealthy = await prismaService.healthCheck();

    // Get database connection info (without sensitive data)
    const dbUrl = process.env.DATABASE_URL;
    let dbInfo = 'unknown';
    if (dbUrl) {
      try {
        const urlObj = new URL(dbUrl.replace('mysql://', 'http://'));
        dbInfo = `${urlObj.hostname}:${urlObj.port || 3306}/${urlObj.pathname.replace('/', '')}`;
      } catch {
        dbInfo = 'configured';
      }
    }

    const health = {
      status: dbHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        database: {
          status: dbHealthy ? 'healthy' : 'unhealthy',
          connection: dbInfo,
        },
        api: 'healthy',
      },
    };

    const statusCode = dbHealthy ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    console.error('❌ [Health] Health check error:', error);
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      services: {
        database: {
          status: 'unhealthy',
          connection: 'error',
        },
        api: 'healthy',
      },
      error: {
        message: 'Health check failed',
      },
    });
  }
});

export default router;

