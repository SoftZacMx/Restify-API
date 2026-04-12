import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { ConfirmMercadoPagoPaymentUseCase } from '../../core/application/use-cases/payments/confirm-mercado-pago-payment.use-case';
import { IOrderRepository } from '../../core/domain/interfaces/order-repository.interface';
import { IWebSocketConnectionManager, WebSocketEventType, WebSocketMessage } from '../../core/domain/interfaces/websocket-connection.interface';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';
import { logger } from '../../shared/utils/logger';

export const mercadoPagoWebhookController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body;

    if (body.type === 'payment' && body.data?.id) {
      const confirmUseCase = container.resolve(ConfirmMercadoPagoPaymentUseCase);
      const result = await confirmUseCase.execute({
        mpPaymentId: body.data.id,
        action: body.action,
      });

      // Notificar al POS si es una orden online pagada
      if (result?.order?.status && result.order.id) {
        try {
          const orderRepository = container.resolve<IOrderRepository>('IOrderRepository');
          const order = await orderRepository.findById(result.order.id);

          if (order && (order.origin === 'online-delivery' || order.origin === 'online-pickup')) {
            const connectionManager = container.resolve<IWebSocketConnectionManager>('IWebSocketConnectionManager');
            const message: WebSocketMessage = {
              type: WebSocketEventType.ORDER_NEW_ONLINE,
              data: {
                orderId: order.id,
                customerName: order.customerName,
                orderType: order.origin === 'online-delivery' ? 'DELIVERY' : 'PICKUP',
                total: order.total,
                createdAt: order.createdAt,
              },
              timestamp: new Date(),
            };
            connectionManager.sendToStaffRoles(message);
          }
        } catch (err) {
          logger.error({ err }, 'Failed to send online order WebSocket notification');
        }
      }
    }

    sendSuccess(res, { received: true });
  } catch (error) {
    next(error);
  }
};
