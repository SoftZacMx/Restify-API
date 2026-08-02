import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { PrismaService } from '../../core/infrastructure/config/prisma.config';
import { AuthenticatedRequest } from './auth.middleware';
import { getTenant } from '../../core/infrastructure/tenant/tenant-context';

export class SubscriptionMiddleware {
  /**
   * Rutas autenticadas: valida la suscripción de la organización del JWT.
   */
  static async validateSubscription(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // Check if billing is disabled
      if (process.env.BILLING_ENABLED === 'false') {
        next();
        return;
      }

      // Get organizationId from JWT
      const organizationId = req.user?.org;
      if (!organizationId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'ORGANIZATION_REQUIRED',
            message: 'Token inválido: falta organizationId',
          },
        });
        return;
      }

      if (await SubscriptionMiddleware.orgHasValidSubscription(organizationId, res)) {
        next();
      }
    } catch (error) {
      SubscriptionMiddleware.failClosed(res);
    }
  }

  /**
   * Rutas públicas (menú/checkout): valida la suscripción de la organización dueña
   * de la sucursal. No hay JWT aquí: la organización sale del tenant context que
   * PublicTenantMiddleware ya resolvió, por lo que DEBE ejecutarse después de él.
   * Un restaurante con suscripción vencida deja de recibir pedidos online.
   */
  static async validatePublicSubscription(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (process.env.BILLING_ENABLED === 'false') {
        next();
        return;
      }

      const organizationId = getTenant()?.organizationId;
      if (!organizationId) {
        // Sin tenant resuelto no se puede validar: fallar cerrado (error de cableado
        // de rutas, no del cliente).
        SubscriptionMiddleware.failClosed(res);
        return;
      }

      if (await SubscriptionMiddleware.orgHasValidSubscription(organizationId, res)) {
        next();
      }
    } catch (error) {
      SubscriptionMiddleware.failClosed(res);
    }
  }

  /**
   * Regla compartida: la organización tiene suscripción ACTIVE/TRIALING vigente,
   * o PAST_DUE dentro del período de gracia. Si no, responde 403 y devuelve false.
   */
  private static async orgHasValidSubscription(
    organizationId: string,
    res: Response
  ): Promise<boolean> {
    const prismaService = container.resolve(PrismaService);
    const prismaClient = prismaService.getClient();

    const subscription = await prismaClient.subscription.findUnique({
      where: { organizationId },
    });

    if (!subscription) {
      res.status(403).json({
        success: false,
        error: {
          code: 'SUBSCRIPTION_REQUIRED',
          message: 'Se requiere una suscripción activa para usar el sistema',
        },
      });
      return false;
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
      return false;
    }

    return true;
  }

  // Fail closed: si no se puede verificar la suscripción, denegar acceso.
  private static failClosed(res: Response): void {
    res.status(503).json({
      success: false,
      error: {
        code: 'SUBSCRIPTION_CHECK_FAILED',
        message: 'No se pudo verificar la suscripción. Intenta de nuevo más tarde.',
      },
    });
  }
}
