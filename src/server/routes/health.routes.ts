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

    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        database: dbHealthy ? 'healthy' : 'unhealthy',
        api: 'healthy',
      },
    };

    const statusCode = dbHealthy ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      services: {
        database: 'unhealthy',
        api: 'healthy',
      },
      error: {
        message: 'Health check failed',
      },
    });
  }
});

export default router;

