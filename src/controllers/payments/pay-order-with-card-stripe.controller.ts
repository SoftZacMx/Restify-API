import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { PayOrderWithCardStripeUseCase } from '../../core/application/use-cases/payments/pay-order-with-card-stripe.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const payOrderWithCardStripeController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const useCase = container.resolve(PayOrderWithCardStripeUseCase);
    const result = await useCase.execute(req.body);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
