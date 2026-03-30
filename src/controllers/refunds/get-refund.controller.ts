import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { GetRefundUseCase } from '../../core/application/use-cases/refunds/get-refund.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const getRefundController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validatedData = {
      refund_id: req.params.refund_id || '',
    };

    const getRefundUseCase = container.resolve(GetRefundUseCase);
    const result = await getRefundUseCase.execute(validatedData);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
