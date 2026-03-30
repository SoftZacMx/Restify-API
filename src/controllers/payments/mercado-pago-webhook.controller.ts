import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { ConfirmMercadoPagoPaymentUseCase } from '../../core/application/use-cases/payments/confirm-mercado-pago-payment.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const mercadoPagoWebhookController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // TODO: Reactivar validación de firma para producción
    // const xSignature = req.headers['x-signature'] as string || '';
    // const xRequestId = req.headers['x-request-id'] as string || '';

    const body = req.body;

    if (body.type === 'payment') {
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
