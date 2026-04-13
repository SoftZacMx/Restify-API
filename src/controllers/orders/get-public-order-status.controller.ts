import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { GetPublicOrderStatusUseCase } from '../../core/application/use-cases/orders/get-public-order-status.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const getPublicOrderStatusController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const useCase = container.resolve(GetPublicOrderStatusUseCase);
    const result = await useCase.execute(req.params.trackingToken);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
