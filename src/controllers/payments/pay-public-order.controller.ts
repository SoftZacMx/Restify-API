import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { PayPublicOrderUseCase } from '../../core/application/use-cases/payments/pay-public-order.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const payPublicOrderController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const useCase = container.resolve(PayPublicOrderUseCase);
    const result = await useCase.execute({ orderId: req.params.orderId });
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
