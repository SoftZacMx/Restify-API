import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { GetPaymentSessionUseCase } from '../../core/application/use-cases/payments/get-payment-session.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const getPaymentSessionController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const useCase = container.resolve(GetPaymentSessionUseCase);
    const result = await useCase.execute({ payment_id: req.params.payment_id });
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
