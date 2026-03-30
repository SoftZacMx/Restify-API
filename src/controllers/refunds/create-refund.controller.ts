import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { CreateRefundUseCase } from '../../core/application/use-cases/refunds/create-refund.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const createRefundController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validatedData = req.body;

    const createRefundUseCase = container.resolve(CreateRefundUseCase);
    const result = await createRefundUseCase.execute(validatedData);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
