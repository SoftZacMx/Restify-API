import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { MercadoPagoService } from '../../core/infrastructure/payment-gateways/mercado-pago.service';
import { ConfirmMercadoPagoPaymentUseCase } from '../../core/application/use-cases/payments/confirm-mercado-pago-payment.use-case';
import { AppError } from '../../shared/errors';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const mercadoPagoWebhookController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const xSignature = req.headers['x-signature'] as string || '';
    const xRequestId = req.headers['x-request-id'] as string || '';
    const dataId = req.query['data.id'] as string || '';

    const mercadoPagoService = container.resolve(MercadoPagoService);
    const isValid = mercadoPagoService.validateWebhookSignature({
      xSignature,
      xRequestId,
      dataId,
    });

    if (!isValid) {
      throw new AppError('INVALID_WEBHOOK_SIGNATURE');
    }

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
