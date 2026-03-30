import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { GetSubscriptionStatusUseCase } from '../../core/application/use-cases/subscription/get-subscription-status.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const getSubscriptionStatusController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const useCase = container.resolve(GetSubscriptionStatusUseCase);
    const result = await useCase.execute();

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
