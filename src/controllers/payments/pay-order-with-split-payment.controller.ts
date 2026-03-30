import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { PayOrderWithSplitPaymentUseCase } from '../../core/application/use-cases/payments/pay-order-with-split-payment.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const payOrderWithSplitPaymentController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const useCase = container.resolve(PayOrderWithSplitPaymentUseCase);
    const result = await useCase.execute(req.body);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
