import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { CancelSubscriptionUseCase } from '../../core/application/use-cases/subscription/cancel-subscription.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const cancelSubscriptionController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const useCase = container.resolve(CancelSubscriptionUseCase);
    const result = await useCase.execute();

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
