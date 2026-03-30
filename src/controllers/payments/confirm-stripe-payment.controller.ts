import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { ConfirmStripePaymentUseCase } from '../../core/application/use-cases/payments/confirm-stripe-payment.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const confirmStripePaymentController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const useCase = container.resolve(ConfirmStripePaymentUseCase);
    const result = await useCase.execute(req.body);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
