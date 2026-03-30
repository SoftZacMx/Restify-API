import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { HandleSubscriptionWebhookUseCase } from '../../core/application/use-cases/subscription/handle-subscription-webhook.use-case';
import { StripeSubscriptionService } from '../../core/infrastructure/payment-gateways/stripe-subscription.service';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const stripeWebhookController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const signature = req.headers['stripe-signature'] || '';
    const payload = req.body || '';

    const stripeService = container.resolve(StripeSubscriptionService);
    const stripeEvent = stripeService.constructWebhookEvent(payload, signature as string);

    const useCase = container.resolve(HandleSubscriptionWebhookUseCase);
    await useCase.execute({ event: stripeEvent });

    sendSuccess(res, { received: true });
  } catch (error) {
    next(error);
  }
};
