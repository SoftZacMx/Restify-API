import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { CreateOrderUseCase } from '../../core/application/use-cases/orders/create-order.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const createOrderController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const createOrderUseCase = container.resolve(CreateOrderUseCase);
    const result = await createOrderUseCase.execute(req.body);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
