import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { z } from 'zod';
import { CreateSubscriptionCheckoutUseCase } from '../../core/application/use-cases/subscription/create-subscription-checkout.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';
import { AppError } from '../../shared/errors';

const createSubscriptionCheckoutSchema = z.object({
  planId: z.string().uuid(),
});

export const createSubscriptionCheckoutController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = (req as any).user;

    const parsed = createSubscriptionCheckoutSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Se requiere un planId válido (UUID)');
    }

    const useCase = container.resolve(CreateSubscriptionCheckoutUseCase);
    const result = await useCase.execute({ userId, planId: parsed.data.planId });

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
