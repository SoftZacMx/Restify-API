import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { GetQRPaymentStatusUseCase } from '../../core/application/use-cases/payments/get-qr-payment-status.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const getQRPaymentStatusController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const useCase = container.resolve(GetQRPaymentStatusUseCase);
    const result = await useCase.execute({ orderId: req.params.orderId });
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
