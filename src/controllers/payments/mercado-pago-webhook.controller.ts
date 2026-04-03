import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { ConfirmMercadoPagoPaymentUseCase } from '../../core/application/use-cases/payments/confirm-mercado-pago-payment.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const mercadoPagoWebhookController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body;

    if (body.type === 'payment' && body.data?.id) {
      const confirmUseCase = container.resolve(ConfirmMercadoPagoPaymentUseCase);
      await confirmUseCase.execute({
        mpPaymentId: body.data.id,
        action: body.action,
      });
    }

    sendSuccess(res, { received: true });
  } catch (error) {
    next(error);
  }
};
