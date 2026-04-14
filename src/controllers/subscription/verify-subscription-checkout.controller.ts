import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { z } from 'zod';
import { VerifySubscriptionCheckoutUseCase } from '../../core/application/use-cases/subscription/verify-subscription-checkout.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';
import { AppError } from '../../shared/errors';

const verifyCheckoutSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
});

export const verifySubscriptionCheckoutController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parsed = verifyCheckoutSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Se requiere un sessionId válido');
    }

    const useCase = container.resolve(VerifySubscriptionCheckoutUseCase);
    const result = await useCase.execute({ sessionId: parsed.data.sessionId });

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
