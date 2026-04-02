import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { CreateSubscriptionCheckoutUseCase } from '../../core/application/use-cases/subscription/create-subscription-checkout.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const createSubscriptionCheckoutController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // userId ya fue verificado por AuthMiddleware.authenticate y está en req.user
    const { userId } = (req as any).user;

    const useCase = container.resolve(CreateSubscriptionCheckoutUseCase);
    const result = await useCase.execute({ userId });

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
