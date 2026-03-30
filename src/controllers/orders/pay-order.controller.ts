import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { PayOrderUseCase } from '../../core/application/use-cases/orders/pay-order.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const payOrderController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payOrderUseCase = container.resolve(PayOrderUseCase);
    const result = await payOrderUseCase.execute(req.body);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
