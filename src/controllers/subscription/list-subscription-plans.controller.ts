import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { ListSubscriptionPlansUseCase } from '../../core/application/use-cases/subscription/list-subscription-plans.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const listSubscriptionPlansController = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const useCase = container.resolve(ListSubscriptionPlansUseCase);
    const result = await useCase.execute();

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
