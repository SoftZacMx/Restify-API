import middy from '@middy/core';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { GetSubscriptionStatusUseCase } from '../../core/application/use-cases/subscription/get-subscription-status.use-case';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const getSubscriptionStatusHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  const useCase = container.resolve(GetSubscriptionStatusUseCase);
  const result = await useCase.execute();

  return result;
};

export const getSubscriptionStatusHandler = middy(getSubscriptionStatusHandlerBase)
  .use(httpEventNormalizer())
  .use(customErrorHandler())
  .use(responseFormatter());
