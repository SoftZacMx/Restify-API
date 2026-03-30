import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { PayOrderWithCashUseCase } from '../../core/application/use-cases/payments/pay-order-with-cash.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const payOrderWithCashController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const useCase = container.resolve(PayOrderWithCashUseCase);
    const result = await useCase.execute(req.body);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
