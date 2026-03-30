import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { ReactivateSubscriptionUseCase } from '../../core/application/use-cases/subscription/reactivate-subscription.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const reactivateSubscriptionController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const useCase = container.resolve(ReactivateSubscriptionUseCase);
    const result = await useCase.execute();

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
