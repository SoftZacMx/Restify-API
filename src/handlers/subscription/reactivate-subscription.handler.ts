import middy from '@middy/core';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { ReactivateSubscriptionUseCase } from '../../core/application/use-cases/subscription/reactivate-subscription.use-case';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const reactivateSubscriptionHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  const useCase = container.resolve(ReactivateSubscriptionUseCase);
  const result = await useCase.execute();

  return result;
};

export const reactivateSubscriptionHandler = middy(reactivateSubscriptionHandlerBase)
  .use(httpEventNormalizer())
  .use(customErrorHandler())
  .use(responseFormatter());
