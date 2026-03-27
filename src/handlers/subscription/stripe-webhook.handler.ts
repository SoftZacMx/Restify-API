import middy from '@middy/core';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { HandleSubscriptionWebhookUseCase } from '../../core/application/use-cases/subscription/handle-subscription-webhook.use-case';
import { StripeSubscriptionService } from '../../core/infrastructure/payment-gateways/stripe-subscription.service';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const stripeWebhookHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  const signature = event.headers['stripe-signature'] || event.headers['Stripe-Signature'] || '';
  const payload = event.body || '';

  const stripeService = container.resolve(StripeSubscriptionService);
  const stripeEvent = stripeService.constructWebhookEvent(payload, signature);

  const useCase = container.resolve(HandleSubscriptionWebhookUseCase);
  await useCase.execute({ event: stripeEvent });

  return { received: true };
};

export const stripeWebhookHandler = middy(stripeWebhookHandlerBase)
  .use(httpEventNormalizer())
  .use(customErrorHandler())
  .use(responseFormatter());
