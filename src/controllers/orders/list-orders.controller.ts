import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { ListOrdersUseCase } from '../../core/application/use-cases/orders/list-orders.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const listOrdersController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const listOrdersUseCase = container.resolve(ListOrdersUseCase);
    const result = await listOrdersUseCase.execute(req.query);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
