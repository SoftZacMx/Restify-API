import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { CreateStripeRefundUseCase } from '../../core/application/use-cases/refunds/create-stripe-refund.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const createStripeRefundController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validatedData = req.body;

    const createStripeRefundUseCase = container.resolve(CreateStripeRefundUseCase);
    const result = await createStripeRefundUseCase.execute(validatedData);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
