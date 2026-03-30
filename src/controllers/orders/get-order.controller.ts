import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { GetOrderUseCase } from '../../core/application/use-cases/orders/get-order.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const getOrderController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const getOrderUseCase = container.resolve(GetOrderUseCase);
    const result = await getOrderUseCase.execute({ order_id: req.params.order_id });
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
