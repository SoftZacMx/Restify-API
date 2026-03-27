import { Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { PrismaService } from '../../core/infrastructure/config/prisma.config';
import { AuthenticatedRequest } from './auth.middleware';

export class SubscriptionMiddleware {
  static async validateSubscription(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const prismaService = container.resolve(PrismaService);
      const prismaClient = prismaService.getClient();

      const subscription = await prismaClient.subscription.findFirst();

      if (!subscription) {
        res.status(403).json({
          success: false,
          error: {
            code: 'SUBSCRIPTION_REQUIRED',
            message: 'Se requiere una suscripción activa para usar el sistema',
          },
        });
        return;
      }

      const now = new Date();
      const isActive =
        (subscription.status === 'ACTIVE' || subscription.status === 'TRIALING') &&
        subscription.currentPeriodEnd &&
        subscription.currentPeriodEnd > now;

      // Período de gracia: 3 días después de vencimiento para PAST_DUE
      const gracePeriodDays = parseInt(process.env.SUBSCRIPTION_GRACE_PERIOD_DAYS || '3', 10);
      const gracePeriodMs = gracePeriodDays * 24 * 60 * 60 * 1000;
      const isPastDueWithGrace =
        subscription.status === 'PAST_DUE' &&
        subscription.currentPeriodEnd &&
        new Date(subscription.currentPeriodEnd.getTime() + gracePeriodMs) > now;

      if (!isActive && !isPastDueWithGrace) {
        res.status(403).json({
          success: false,
          error: {
            code: 'SUBSCRIPTION_EXPIRED',
            message: 'Tu suscripción ha vencido. Renueva para continuar usando el sistema.',
          },
        });
        return;
      }

      next();
    } catch (error) {
      next();
    }
  }
}
