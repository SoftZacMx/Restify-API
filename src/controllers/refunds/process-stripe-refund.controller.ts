import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { ProcessStripeRefundUseCase } from '../../core/application/use-cases/refunds/process-stripe-refund.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const processStripeRefundController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validatedData = req.body;

    const processStripeRefundUseCase = container.resolve(ProcessStripeRefundUseCase);
    const result = await processStripeRefundUseCase.execute(validatedData);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
