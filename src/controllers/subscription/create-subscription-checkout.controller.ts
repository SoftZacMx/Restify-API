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
    // userId viene del token JWT (inyectado por el auth middleware en el header)
    const authHeader = req.headers.authorization || req.headers['authorization'] || '';
    const token = (authHeader as string).replace('Bearer ', '');

    // Decodificar el payload del JWT para obtener userId
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());

    const useCase = container.resolve(CreateSubscriptionCheckoutUseCase);
    const result = await useCase.execute({ userId: payload.userId });

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
