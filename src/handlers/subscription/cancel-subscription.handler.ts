import middy from '@middy/core';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { CancelSubscriptionUseCase } from '../../core/application/use-cases/subscription/cancel-subscription.use-case';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const cancelSubscriptionHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  const useCase = container.resolve(CancelSubscriptionUseCase);
  const result = await useCase.execute();

  return result;
};

export const cancelSubscriptionHandler = middy(cancelSubscriptionHandlerBase)
  .use(httpEventNormalizer())
  .use(customErrorHandler())
  .use(responseFormatter());
