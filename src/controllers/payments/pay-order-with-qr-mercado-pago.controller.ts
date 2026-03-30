import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { PayOrderWithQRMercadoPagoUseCase } from '../../core/application/use-cases/payments/pay-order-with-qr-mercado-pago.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const payOrderWithQRMercadoPagoController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const useCase = container.resolve(PayOrderWithQRMercadoPagoUseCase);
    const result = await useCase.execute(req.body);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
