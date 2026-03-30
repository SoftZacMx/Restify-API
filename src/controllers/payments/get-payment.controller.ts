import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { GetPaymentUseCase } from '../../core/application/use-cases/payments/get-payment.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const getPaymentController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const useCase = container.resolve(GetPaymentUseCase);
    const result = await useCase.execute({ payment_id: req.params.payment_id });
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
