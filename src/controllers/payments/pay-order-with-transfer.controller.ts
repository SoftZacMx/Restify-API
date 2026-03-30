import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { PayOrderWithTransferUseCase } from '../../core/application/use-cases/payments/pay-order-with-transfer.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const payOrderWithTransferController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const useCase = container.resolve(PayOrderWithTransferUseCase);
    const result = await useCase.execute(req.body);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
