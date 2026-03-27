import middy from '@middy/core';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { CreateSubscriptionCheckoutUseCase } from '../../core/application/use-cases/subscription/create-subscription-checkout.use-case';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const createSubscriptionCheckoutHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  // userId viene del token JWT (inyectado por el auth middleware en el header)
  const authHeader = event.headers?.authorization || event.headers?.Authorization || '';
  const token = authHeader.replace('Bearer ', '');

  // Decodificar el payload del JWT para obtener userId
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());

  const useCase = container.resolve(CreateSubscriptionCheckoutUseCase);
  const result = await useCase.execute({ userId: payload.userId });

  return result;
};

export const createSubscriptionCheckoutHandler = middy(createSubscriptionCheckoutHandlerBase)
  .use(httpEventNormalizer())
  .use(customErrorHandler())
  .use(responseFormatter());
