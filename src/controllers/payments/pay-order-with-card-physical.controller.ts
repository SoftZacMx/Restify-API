import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { PayOrderWithCardPhysicalUseCase } from '../../core/application/use-cases/payments/pay-order-with-card-physical.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const payOrderWithCardPhysicalController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const useCase = container.resolve(PayOrderWithCardPhysicalUseCase);
    const result = await useCase.execute(req.body);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
